
import { queryOne } from '../src/config/database.js';
import { sleeperApi } from '../src/services/sleeper-api.service.js';

const START_ID = '1312068808722096128'; // Bears BR (2026)

async function traceHistory() {
    console.log(`🕵️ TRACING HISTORY FOR LEAGUE: ${START_ID}\n`);

    let currentId = START_ID;
    let depth = 0;

    while (currentId && currentId !== '0') {
        console.log(`\n--- Depth ${depth} ---`);
        console.log(`   Target ID: ${currentId}`);

        // 1. Check Local
        const local: any = queryOne('SELECT league_id, name, season, previous_league_id FROM leagues WHERE league_id = ?', [currentId]);

        if (local) {
            console.log(`   📂 LOCAL: Found! [${local.season}] ${local.name} (Prev: ${local.previous_league_id})`);
        } else {
            console.log(`   📂 LOCAL: ❌ Missing from database`);
        }

        // 2. Check Sleeper API (to see what SHOULD be there)
        try {
            const remote = await sleeperApi.getLeague(currentId);
            console.log(`   ☁️ REMOTE: Found! [${remote.season}] ${remote.name} (Prev: ${remote.previous_league_id})`);

            // Advance chain based on Remote (truth)
            currentId = remote.previous_league_id;
        } catch (e: any) {
            console.log(`   ☁️ REMOTE: Error - ${e.message}`);
            currentId = local?.previous_league_id; // Fallback if remote fails but local exists
            if (!currentId) break;
        }

        depth++;
        if (depth > 10) {
            console.log("   ⚠️ Forced stop at depth 10");
            break;
        }
    }
}

traceHistory();
