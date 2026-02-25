import { query } from './src/config/database.js';

async function test() {
    try {
        const sql = `
            SELECT DISTINCT su.* 
            FROM sleeper_users su
            JOIN rosters r ON su.user_id = r.owner_id
            JOIN leagues l ON r.league_id = l.league_id
            WHERE l.is_active = 1
            ORDER BY su.display_name ASC
        `;
        const users = query(sql);
        console.log('--- USERS RETURNED BY QUERY ---');
        console.log(users.length);
        console.log(users);
    } catch (e) {
        console.error(e);
    }
}

test();
