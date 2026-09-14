import axios from 'axios';
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { getDb, execute, query } from '../config/database.js';

export interface FantasyNewsItem {
    news_id: string;
    source: string;
    title: string;
    summary: string;
    link: string;
    category: 'injury' | 'waiver' | 'trade' | 'analysis' | 'general';
    player_ids?: string[];
    published_at: string;
}

export class NewsScraperService {
    private xmlParser: XMLParser;
    private client = axios.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/xml,application/json,text/xml,*/*'
        },
        timeout: 10000
    });

    constructor() {
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_'
        });
    }

    private cleanHtml(raw: string): string {
        if (!raw) return '';
        return raw
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    private detectCategory(title: string, summary: string): 'injury' | 'waiver' | 'trade' | 'analysis' | 'general' {
        const text = `${title} ${summary}`.toLowerCase();
        if (/injur|questionable|doubtful|out for|ir\b|injured reserve|concussion|acl|hamstring|ankle|knee|groin|surgery|dnp\b|did not practice/.test(text)) {
            return 'injury';
        }
        if (/waiver|faab|wire pickup|streaming|add\/drop|streamer|claim/.test(text)) {
            return 'waiver';
        }
        if (/trade|traded|acquires|swap|deal/.test(text)) {
            return 'trade';
        }
        if (/projection|rankings|start\/sit|start em|sit em|sleepers|busts|target share/.test(text)) {
            return 'analysis';
        }
        return 'general';
    }

    /**
     * Find matching player IDs from the database given headline text
     */
    private matchPlayers(text: string): string[] {
        if (!text) return [];
        try {
            // Find players with search_full_name matching words in text
            // For efficiency, we query top fantasy players whose names appear in text
            const words = text.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length >= 3);
            if (words.length < 2) return [];

            // Fast matching by checking full name directly in DB for high-rank players
            const db = getDb();
            const rows = db.prepare(`
                SELECT player_id, full_name 
                FROM players 
                WHERE search_rank IS NOT NULL AND search_rank < 500
            `).all() as Array<{ player_id: string; full_name: string }>;

            const matched: string[] = [];
            const textLower = text.toLowerCase();

            for (const r of rows) {
                if (r.full_name && r.full_name.length > 4 && textLower.includes(r.full_name.toLowerCase())) {
                    matched.push(r.player_id);
                    if (matched.length >= 3) break; // Limit to top 3
                }
            }
            return matched;
        } catch {
            return [];
        }
    }

    private generateNewsId(source: string, title: string, link: string): string {
        return crypto.createHash('md5').update(`${source}:${title}:${link}`).digest('hex');
    }

    /**
     * Fetch standard RSS feeds
     */
    async fetchRSS(url: string, source: string): Promise<FantasyNewsItem[]> {
        try {
            console.log(`📡 Fetching RSS from ${source} (${url})...`);
            const res = await this.client.get(url);
            const parsed = this.xmlParser.parse(res.data);
            const items = parsed.rss?.channel?.item || parsed.feed?.entry || [];
            const itemList = Array.isArray(items) ? items : [items];

            const newsItems: FantasyNewsItem[] = [];

            for (const item of itemList.slice(0, 20)) {
                const title = this.cleanHtml(item.title || '');
                const summary = this.cleanHtml(item.description || item.summary || item['content:encoded'] || '');
                const link = item.link?.['#text'] || item.link || '';
                const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();

                if (!title) continue;

                const newsId = this.generateNewsId(source, title, link);
                const category = this.detectCategory(title, summary);
                const playerIds = this.matchPlayers(`${title} ${summary}`);

                newsItems.push({
                    news_id: newsId,
                    source,
                    title,
                    summary: summary.slice(0, 500),
                    link,
                    category,
                    player_ids: playerIds,
                    published_at: new Date(pubDate).toISOString()
                });
            }

            return newsItems;
        } catch (error: any) {
            console.error(`⚠️ Failed to fetch RSS from ${source}:`, error.message);
            return [];
        }
    }

    /**
     * Fetch breaking news from Reddit r/fantasyfootball
     */
    async fetchReddit(): Promise<FantasyNewsItem[]> {
        try {
            console.log('📡 Fetching Reddit r/fantasyfootball breaking news via RSS...');
            const res = await fetch('https://www.reddit.com/r/fantasyfootball/.rss', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!res.ok) throw new Error(`Reddit returned status ${res.status}`);

            const text = await res.text();
            const parsed = this.xmlParser.parse(text);
            const entries = parsed.feed?.entry || [];
            const entryList = Array.isArray(entries) ? entries : [entries];

            const newsItems: FantasyNewsItem[] = [];

            for (const entry of entryList.slice(0, 15)) {
                const title = this.cleanHtml(entry.title || '');
                const summary = this.cleanHtml(entry.content?.['#text'] || entry.content || '');
                const link = entry.link?.['@_href'] || entry.link || '';
                const pubDate = entry.updated || entry.published || new Date().toISOString();

                if (!title) continue;

                const newsId = this.generateNewsId('reddit', title, link);
                const category = this.detectCategory(title, summary);
                const playerIds = this.matchPlayers(`${title} ${summary}`);

                newsItems.push({
                    news_id: newsId,
                    source: 'reddit_fantasy',
                    title,
                    summary: summary.slice(0, 500),
                    link,
                    category,
                    player_ids: playerIds,
                    published_at: new Date(pubDate).toISOString()
                });
            }

            return newsItems;
        } catch (error: any) {
            console.error('⚠️ Failed to fetch Reddit breaking news:', error.message);
            return [];
        }
    }

    /**
     * Run full news aggregation across all sources and save to DB
     */
    async syncAllNews(): Promise<number> {
        console.log('📰 Starting multi-source Fantasy Football News Sync...');

        const sources = [
            { url: 'https://www.rotowire.com/rss/news.php?sport=NFL', name: 'rotowire' },
            { url: 'https://www.fantasypros.com/feed/', name: 'fantasypros' },
            { url: 'https://profootballtalk.nbcsports.com/feed/', name: 'profootballtalk' },
            { url: 'https://sports.yahoo.com/nfl/rss/', name: 'yahoo_nfl' }
        ];

        const allNews: FantasyNewsItem[] = [];

        for (const s of sources) {
            const items = await this.fetchRSS(s.url, s.name);
            allNews.push(...items);
        }

        const redditItems = await this.fetchReddit();
        allNews.push(...redditItems);

        if (allNews.length === 0) {
            console.log('ℹ️ No news items gathered.');
            return 0;
        }

        const db = getDb();
        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO fantasy_news (
                news_id, source, title, summary, link, category, player_ids, published_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        let insertedCount = 0;
        const insertMany = db.transaction((items: FantasyNewsItem[]) => {
            for (const item of items) {
                const info = insertStmt.run(
                    item.news_id,
                    item.source,
                    item.title,
                    item.summary,
                    item.link,
                    item.category,
                    item.player_ids ? JSON.stringify(item.player_ids) : null,
                    item.published_at
                );
                if (info.changes > 0) insertedCount++;
            }
        });

        insertMany(allNews);
        console.log(`✅ Saved ${insertedCount} new news articles (${allNews.length} processed)`);
        return insertedCount;
    }

    /**
     * Query latest news with optional filter
     */
    getLatestNews(limit: number = 20, category?: string): FantasyNewsItem[] {
        let sql = 'SELECT * FROM fantasy_news ';
        const params: any[] = [];
        if (category) {
            sql += 'WHERE category = ? ';
            params.push(category);
        }
        sql += 'ORDER BY published_at DESC LIMIT ?';
        params.push(limit);

        const rows = query(sql, params);
        return rows.map((r: any) => ({
            ...r,
            player_ids: r.player_ids ? JSON.parse(r.player_ids) : []
        }));
    }
}

export const newsScraper = new NewsScraperService();
