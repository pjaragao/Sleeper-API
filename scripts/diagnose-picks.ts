
import { query } from '../src/config/database.js';
import * as fs from 'fs';

// Fetch a sample trade with draft picks
const trades = query(`
    SELECT t.transaction_id, t.league_id, t.draft_picks, l.name as league_name
    FROM transactions t
    JOIN leagues l ON t.league_id = l.league_id
    WHERE t.type = 'trade' AND t.draft_picks IS NOT NULL AND t.draft_picks != '[]'
    LIMIT 3
`) as any[];

let output = '🔍 SAMPLE TRADES WITH DRAFT PICKS:\n\n';

trades.forEach((t, i) => {
    output += `--- Trade ${i + 1} (${t.league_name}) ---\n`;
    output += `   Transaction ID: ${t.transaction_id}\n`;
    output += `   League ID: ${t.league_id}\n`;

    const picks = JSON.parse(t.draft_picks || '[]');
    output += `   Draft Picks (${picks.length}):\n`;
    picks.forEach((p: any, j: number) => {
        output += `     Pick ${j + 1}: ${JSON.stringify(p)}\n`;
    });
    output += '\n';
});

// Now check what's in the rosters table for reference
output += '\n🗂️ SAMPLE ROSTERS FOR ONE LEAGUE:\n';
if (trades.length > 0) {
    const rosters = query(`
        SELECT r.league_id, r.roster_id, r.owner_id, su.display_name
        FROM rosters r
        LEFT JOIN sleeper_users su ON r.owner_id = su.user_id
        WHERE r.league_id = ?
    `, [trades[0].league_id]) as any[];

    rosters.forEach(r => {
        output += `   Roster ${r.roster_id} | Owner ID: ${r.owner_id} | Name: ${r.display_name}\n`;
    });
}

fs.writeFileSync('./pick-diagnosis.txt', output);
console.log('✅ Output written to pick-diagnosis.txt');
