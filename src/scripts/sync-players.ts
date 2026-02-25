import dotenv from 'dotenv';
import { testConnection, closeDb } from '../config/database.js';
import { syncPlayers, syncNFLState, syncTrending } from '../services/sync.service.js';

dotenv.config();

async function syncPlayersScript() {
    console.log('\n🏈 Sleeper Fantasy Assistant - Players Sync\n');
    console.log('='.repeat(50));

    if (!testConnection()) {
        console.error('❌ Database connection failed. Please run migrations first: npm run db:migrate');
        process.exit(1);
    }

    try {
        // Sync NFL state first
        await syncNFLState();

        // Sync all players
        const count = await syncPlayers();
        console.log(`\n✅ Successfully synced ${count} players!`);

        // Also sync trending
        await syncTrending();

    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    } finally {
        closeDb();
    }
}

syncPlayersScript();
