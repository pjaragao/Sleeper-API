import Database from 'better-sqlite3';

const db = new Database('./data/sleeper.db');

const users = db.prepare(`
    SELECT su.user_id, su.display_name, COUNT(DISTINCT l.league_id) as league_count
    FROM sleeper_users su
    JOIN rosters r ON su.user_id = r.owner_id
    JOIN leagues l ON r.league_id = l.league_id
    GROUP BY su.user_id
    ORDER BY league_count DESC
    LIMIT 10
`).all();

console.log('Top users by imported leagues:', users);

const leagues = db.prepare(`
    SELECT league_id, name, season, status 
    FROM leagues 
    ORDER BY season DESC 
    LIMIT 20
`).all();

console.log('Latest seasons in DB:', leagues);

db.close();
