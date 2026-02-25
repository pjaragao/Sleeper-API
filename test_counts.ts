import { query } from './src/config/database.js';

async function test() {
    try {
        const leagues = query('SELECT COUNT(*) as c FROM leagues')[0].c;
        const activeLeagues = query('SELECT COUNT(*) as c FROM leagues WHERE is_active = 1')[0].c;
        const rosters = query('SELECT COUNT(*) as c FROM rosters')[0].c;
        const users = query('SELECT COUNT(*) as c FROM sleeper_users')[0].c;
        console.log({ leagues, activeLeagues, rosters, users });

        const importedUsers = query(`
            SELECT DISTINCT su.display_name
            FROM sleeper_users su
            JOIN rosters r ON su.user_id = r.owner_id
            JOIN leagues l ON r.league_id = l.league_id
            WHERE l.is_active = 1
        `);
        console.log('Imported Users (names only):', importedUsers.map(u => u.display_name));
    } catch (e) {
        console.error(e);
    }
}

test();
