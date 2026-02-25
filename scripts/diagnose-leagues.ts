
import { queryOne } from '../src/config/database.js';
import { sleeperApi } from '../src/services/sleeper-api.service.js';

const leagueIds = [
    '1180177705810243584', // Dynasty Javali 2.0
    '1312068808722096128', // Bears BR
    '1048278665324380160'  // Os Mormaiis
];

async function diagnose() {
    console.log('🔍 DIAGNOSING LEAGUES...\n');

    for (const id of leagueIds) {
        console.log(`Checking League ID: ${id}`);
        console.log('------------------------------------------------');

        // 1. Check Local DB
        const local: any = queryOne('SELECT name, season, status, previous_league_id FROM leagues WHERE league_id = ?', [id]);
        if (local) {
            console.log(`📂 LOCAL DB:`);
            console.log(`   Name: ${local.name}`);
            console.log(`   Season: ${local.season}`);
            console.log(`   Status: ${local.status}`);
            console.log(`   Prev ID: ${local.previous_league_id}`);
        } else {
            console.log(`📂 LOCAL DB: ❌ Not found`);
        }

        // 2. Check Sleeper API
        try {
            const remote = await sleeperApi.getLeague(id);
            console.log(`☁️ SLEEPER API:`);
            console.log(`   Name: ${remote.name}`);
            console.log(`   Season: ${remote.season}`);
            console.log(`   Status: ${remote.status}`);
            console.log(`   Prev ID: ${remote.previous_league_id}`);
        } catch (e: any) {
            console.log(`☁️ SLEEPER API: ❌ Error - ${e.message}`);
        }
        console.log('\n');
    }
}

diagnose();
