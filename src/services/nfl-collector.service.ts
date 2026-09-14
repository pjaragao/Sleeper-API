import axios from 'axios';
import { getDb, execute, query, queryOne } from '../config/database.js';

export interface NFLGameRecord {
    game_id: string;
    season: string;
    season_type: string;
    week: number;
    home_team: string;
    away_team: string;
    home_score: number;
    away_score: number;
    status: 'scheduled' | 'in_progress' | 'final';
    status_detail: string;
    game_date: string;
    venue?: string;
    leaders?: Record<string, any>;
    odds?: Record<string, any>;
}

export class NFLCollectorService {
    private client = axios.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        },
        timeout: 15000
    });

    /**
     * Syncs NFL scoreboard from ESPN Public API
     */
    async syncScoreboard(week?: number, seasonYear?: string): Promise<NFLGameRecord[]> {
        try {
            let url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
            const params: Record<string, any> = {};
            if (week) params.week = week;
            if (seasonYear) params.season = seasonYear;

            console.log(`🏈 Syncing NFL Scoreboard${week ? ` (Week ${week})` : ''}...`);
            const urlObj = new URL('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
            if (week) urlObj.searchParams.set('week', String(week));
            if (seasonYear) urlObj.searchParams.set('season', seasonYear);

            const res = await fetch(urlObj.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) {
                throw new Error(`ESPN returned status ${res.status}`);
            }

            const data = await res.json() as any;

            const targetWeek = week || data.week?.number || 1;
            const targetSeason = seasonYear || String(data.season?.year || new Date().getFullYear());
            const events = data.events || [];

            const games: NFLGameRecord[] = [];
            const db = getDb();

            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO nfl_games (
                    game_id, season, season_type, week, home_team, away_team,
                    home_score, away_score, status, status_detail, game_date,
                    venue, leaders, odds, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `);

            const insertMany = db.transaction((records: NFLGameRecord[]) => {
                for (const g of records) {
                    insertStmt.run(
                        g.game_id,
                        g.season,
                        g.season_type,
                        g.week,
                        g.home_team,
                        g.away_team,
                        g.home_score,
                        g.away_score,
                        g.status,
                        g.status_detail,
                        g.game_date,
                        g.venue || null,
                        g.leaders ? JSON.stringify(g.leaders) : null,
                        g.odds ? JSON.stringify(g.odds) : null
                    );
                }
            });

            for (const event of events) {
                const competition = event.competitions?.[0];
                if (!competition) continue;

                const competitors = competition.competitors || [];
                const home = competitors.find((c: any) => c.homeAway === 'home');
                const away = competitors.find((c: any) => c.homeAway === 'away');

                if (!home || !away) continue;

                // Determine game status
                const statusState = competition.status?.type?.state; // 'pre', 'in', 'post'
                let status: 'scheduled' | 'in_progress' | 'final' = 'scheduled';
                if (statusState === 'in') status = 'in_progress';
                else if (statusState === 'post') status = 'final';

                // Extract game leaders (Passing, Rushing, Receiving)
                const leadersMap: Record<string, any> = {};
                if (competition.leaders) {
                    for (const leaderCategory of competition.leaders) {
                        const topPlayer = leaderCategory.leaders?.[0];
                        if (topPlayer) {
                            leadersMap[leaderCategory.name] = {
                                displayName: topPlayer.athlete?.displayName,
                                team: topPlayer.team?.abbreviation,
                                value: topPlayer.displayValue
                            };
                        }
                    }
                }

                // Odds (spread / over-under)
                const oddsData = competition.odds?.[0];
                const odds = oddsData ? {
                    details: oddsData.details,
                    overUnder: oddsData.overUnder
                } : undefined;

                const gameRecord: NFLGameRecord = {
                    game_id: String(event.id),
                    season: targetSeason,
                    season_type: 'regular',
                    week: Number(targetWeek),
                    home_team: home.team?.abbreviation || home.team?.name,
                    away_team: away.team?.abbreviation || away.team?.name,
                    home_score: parseInt(home.score || '0', 10),
                    away_score: parseInt(away.score || '0', 10),
                    status,
                    status_detail: competition.status?.type?.detail || competition.status?.type?.description || '',
                    game_date: competition.date || event.date,
                    venue: competition.venue?.fullName,
                    leaders: Object.keys(leadersMap).length > 0 ? leadersMap : undefined,
                    odds
                };

                games.push(gameRecord);
            }

            insertMany(games);
            console.log(`✅ Synced ${games.length} NFL games for Season ${targetSeason}, Week ${targetWeek}`);
            return games;
        } catch (error: any) {
            console.error('❌ Failed to sync NFL Scoreboard:', error.message);
            return [];
        }
    }

    /**
     * Syncs actual NFL player stats from Sleeper's stats endpoint
     */
    async syncPlayerStats(season: string, week: number, seasonType: string = 'regular'): Promise<number> {
        try {
            console.log(`📊 Syncing NFL Player Stats for ${season} Week ${week}...`);
            const url = `https://api.sleeper.app/v1/stats/nfl/${seasonType}/${season}/${week}`;
            const res = await this.client.get(url);
            const data = res.data || {};

            const playerIds = Object.keys(data);
            if (playerIds.length === 0) {
                console.log(`ℹ️ No player stats found for ${season} Week ${week}`);
                return 0;
            }

            const db = getDb();
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO nfl_player_stats (
                    player_id, season, season_type, week,
                    pts_ppr, pts_half_ppr, pts_std, stats, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `);

            const insertMany = db.transaction((ids: string[]) => {
                for (const pid of ids) {
                    const st = data[pid] || {};
                    const ppr = st.pts_ppr ?? (st.pts_std ? st.pts_std + (st.rec || 0) : 0);
                    const halfPpr = st.pts_half_ppr ?? (st.pts_std ? st.pts_std + (st.rec || 0) * 0.5 : 0);
                    const std = st.pts_std ?? 0;

                    insertStmt.run(
                        pid,
                        season,
                        seasonType,
                        week,
                        Number(ppr) || 0,
                        Number(halfPpr) || 0,
                        Number(std) || 0,
                        JSON.stringify(st)
                    );
                }
            });

            insertMany(playerIds);
            console.log(`✅ Synced stats for ${playerIds.length} players (${season} W${week})`);
            return playerIds.length;
        } catch (error: any) {
            console.error(`❌ Failed to sync NFL player stats for ${season} W${week}:`, error.message);
            return 0;
        }
    }

    /**
     * Syncs weekly player projections from Sleeper
     */
    async syncPlayerProjections(season: string, week: number, seasonType: string = 'regular'): Promise<number> {
        try {
            console.log(`🔮 Syncing NFL Player Projections for ${season} Week ${week}...`);
            const url = `https://api.sleeper.app/v1/projections/nfl/${seasonType}/${season}/${week}`;
            const res = await this.client.get(url);
            const data = res.data || {};

            const playerIds = Object.keys(data);
            if (playerIds.length === 0) {
                console.log(`ℹ️ No projections found for ${season} Week ${week}`);
                return 0;
            }

            const db = getDb();
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO nfl_player_projections (
                    player_id, season, season_type, week,
                    proj_pts_ppr, proj_pts_half_ppr, proj_pts_std, projections, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `);

            const insertMany = db.transaction((ids: string[]) => {
                for (const pid of ids) {
                    const pj = data[pid] || {};
                    const ppr = pj.pts_ppr ?? 0;
                    const halfPpr = pj.pts_half_ppr ?? 0;
                    const std = pj.pts_std ?? 0;

                    insertStmt.run(
                        pid,
                        season,
                        seasonType,
                        week,
                        Number(ppr) || 0,
                        Number(halfPpr) || 0,
                        Number(std) || 0,
                        JSON.stringify(pj)
                    );
                }
            });

            insertMany(playerIds);
            console.log(`✅ Synced projections for ${playerIds.length} players (${season} W${week})`);
            return playerIds.length;
        } catch (error: any) {
            console.error(`❌ Failed to sync NFL projections for ${season} W${week}:`, error.message);
            return 0;
        }
    }

    /**
     * Get top weekly fantasy scorers by position
     */
    getWeeklyTopPerformers(season: string, week: number, limit: number = 20): Array<{
        player_id: string;
        full_name: string;
        position: string;
        team: string;
        pts_ppr: number;
        pts_half_ppr: number;
        stats: any;
    }> {
        const rows = query(`
            SELECT 
                s.player_id,
                COALESCE(p.full_name, s.player_id) as full_name,
                COALESCE(p.position, CASE WHEN LENGTH(s.player_id) <= 3 THEN 'DEF' ELSE 'FLEX' END) as position,
                COALESCE(p.team, s.player_id) as team,
                s.pts_ppr,
                s.pts_half_ppr,
                s.stats
            FROM nfl_player_stats s
            LEFT JOIN players p ON s.player_id = p.player_id
            WHERE s.season = ? AND s.week = ? AND s.pts_ppr > 0 AND s.player_id NOT LIKE 'TEAM_%'
            ORDER BY s.pts_ppr DESC
            LIMIT ?
        `, [season, week, limit]) as any[];

        return rows.map(r => ({
            ...r,
            full_name: r.position === 'DEF' && !r.full_name.includes('D/ST') ? `${r.team} D/ST` : r.full_name
        }));
    }

    /**
     * Get NFL games for a week
     */
    getWeeklyGames(season: string, week: number): NFLGameRecord[] {
        const rows = query<any>(`
            SELECT * FROM nfl_games
            WHERE season = ? AND week = ?
            ORDER BY game_date ASC
        `, [season, week]);

        return rows.map(r => ({
            ...r,
            leaders: r.leaders ? (typeof r.leaders === 'string' ? JSON.parse(r.leaders) : r.leaders) : undefined,
            odds: r.odds ? (typeof r.odds === 'string' ? JSON.parse(r.odds) : r.odds) : undefined
        }));
    }
}

export const nflCollector = new NFLCollectorService();
