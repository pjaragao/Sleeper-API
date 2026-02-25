import { query } from './src/config/database.js';

async function test() {
    const logs = query('SELECT * FROM sync_logs WHERE league_id = ? OR league_id = ? ORDER BY started_at DESC', ['1312694161610113024', '1180282402537496576']);
    console.log('Sync Logs:', logs);

    const nflState = query('SELECT * FROM nfl_state');
    console.log('NFL State:', nflState);
}

test();
