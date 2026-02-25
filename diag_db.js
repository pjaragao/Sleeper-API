import { query } from './src/config/database.js';

async function diag() {
    try {
        const users = query('SELECT * FROM sleeper_users');
        console.log('--- USERS ---');
        console.log(JSON.stringify(users, null, 2));

        const leagues = query('SELECT * FROM leagues');
        console.log('--- LEAGUES ---');
        console.log(JSON.stringify(leagues, null, 2));

        const rosters = query('SELECT DISTINCT owner_id, league_id FROM rosters');
        console.log('--- ROSTER OWNERS ---');
        console.log(JSON.stringify(rosters, null, 2));
    } catch (e) {
        console.error(e);
    }
}

diag();
