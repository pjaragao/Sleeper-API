import { nflCollector } from '../services/nfl-collector.service.js';
import { newsScraper } from '../services/news-scraper.service.js';
import { syncTrending, syncNFLState } from '../services/sync.service.js';
import { kbGenerator } from '../services/kb-generator.service.js';
import { queryOne, closeDb } from '../config/database.js';

async function runKBSync() {
    console.log('🚀 Starting Full Knowledge Base Sync & Generation...\n');

    try {
        // 1. Sync current NFL State
        console.log('--- Step 1: NFL State ---');
        await syncNFLState();

        const nflState = queryOne('SELECT * FROM nfl_state WHERE id = 1') as any;
        const currentSeason = nflState?.season || '2024';
        const currentWeek = nflState?.week || 1;

        // 2. Sync NFL Games (ESPN)
        console.log('\n--- Step 2: NFL Scoreboard (ESPN) ---');
        await nflCollector.syncScoreboard(currentWeek, currentSeason);

        // 3. Sync NFL Player Stats & Projections (Sleeper)
        console.log('\n--- Step 3: NFL Stats & Projections ---');
        await nflCollector.syncPlayerStats(currentSeason, currentWeek);
        await nflCollector.syncPlayerProjections(currentSeason, currentWeek);

        // 4. Sync Trending Players (Sleeper)
        console.log('\n--- Step 4: Trending Adds/Drops ---');
        await syncTrending();

        // 5. Scrape Multi-source Fantasy News & Injuries
        console.log('\n--- Step 5: Fantasy News & Injury Reports ---');
        await newsScraper.syncAllNews();

        // 6. Generate all Markdown Files for Hermes
        console.log('\n--- Step 6: Generate Markdown Knowledge Base ---');
        const stats = await kbGenerator.generateAll();

        console.log(`\n✅ Full sync and KB generation completed successfully!`);
        console.log(`📊 Statistics: ${stats.leaguesCount} league families processed, ${stats.filesCount} markdown files created.`);

    } catch (error: any) {
        console.error('❌ KB Sync failed:', error);
    } finally {
        closeDb();
    }
}

runKBSync();
