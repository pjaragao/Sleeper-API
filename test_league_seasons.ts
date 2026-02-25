import { query, queryOne } from './src/config/database.js';

async function test() {
    const l = queryOne('SELECT name FROM leagues WHERE league_id = ?', ['1312694161610113024']) as any;
    console.log('League Name:', l?.name);
    if (l) {
        const seasons = query('SELECT league_id, season, status, previous_league_id FROM leagues WHERE name = ? ORDER BY season DESC', [l.name]);
        console.log('Seasons in DB:', seasons);
    }
}

test();
