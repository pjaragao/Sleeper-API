import dotenv from 'dotenv';
import { testConnection, closeDb } from '../config/database.js';
import {
    syncPlayers,
    syncNFLState,
    syncTrending,
    syncAllLeagues,
    syncAllMatchupsCurrentWeek,
    syncAllTransactionsCurrentWeek
} from '../services/sync.service.js';

dotenv.config();

async function syncAllScript() {
    console.log('\n🔄 Sleeper Fantasy Assistant - Full Sync\n');
    console.log('='.repeat(50));

    if (!testConnection()) {
        console.error('❌ Database connection failed. Please run migrations first: npm run db:migrate');
        process.exit(1);
    }

    try {
        const startTime = Date.now();

        // 1. Sync NFL state
        console.log('\n📅 Step 1/6: Syncing NFL state...');
        await syncNFLState();

        // 2. Sync all players
        console.log('\n🏈 Step 2/6: Syncing players (this may take a while)...');
        await syncPlayers();

        // 3. Sync trending players
        console.log('\n📈 Step 3/6: Syncing trending players...');
        await syncTrending();

        // 4. Sync all leagues
        console.log('\n📊 Step 4/6: Syncing all leagues...');
        await syncAllLeagues();

        // 5. Sync current week matchups
        console.log('\n🎯 Step 5/6: Syncing current week matchups...');
        await syncAllMatchupsCurrentWeek();

        // 6. Sync current week transactions
        console.log('\n💱 Step 6/6: Syncing current week transactions...');
        await syncAllTransactionsCurrentWeek();

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n${'='.repeat(50)}`);
        console.log(`✅ Full sync completed in ${duration}s!`);

    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    } finally {
        closeDb();
    }
}

syncAllScript();
