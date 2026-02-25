import { query } from './src/config/database.js';

async function diag() {
    try {
        const users = query('SELECT * FROM sleeper_users');
        console.log('--- USERS ---');
        console.log(users.length, 'users found');
        console.log(users.slice(0, 3));

        const leagues = query('SELECT * FROM leagues');
        console.log('--- LEAGUES ---');
        console.log(leagues.length, 'leagues found');
        console.log(leagues.slice(0, 3));

        const rosters = query('SELECT DISTINCT owner_id, league_id FROM rosters');
        console.log('--- ROSTER OWNERS ---');
        console.log(rosters.length, 'roster-league combinations');
        console.log(rosters.slice(0, 3));

        const importedQuery = `
            SELECT DISTINCT su.* 
            FROM sleeper_users su
            JOIN rosters r ON su.user_id = r.owner_id
            JOIN leagues l ON r.league_id = l.league_id
            WHERE l.is_active = 1
            ORDER BY su.display_name ASC
        `;
        const test = query(importedQuery);
        console.log('--- TEST IMPORTED USERS QUERY ---');
        console.log(test.length, 'results');
        console.log(test);

    } catch (e) {
        console.error('DIAG ERROR:', e);
    }
}

diag();
