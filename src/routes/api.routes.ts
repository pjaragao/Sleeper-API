import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../config/database.js';
import { sleeperApi, SleeperUser } from '../services/sleeper-api.service.js';
import {
    syncPlayers,
    syncLeague,
    syncAllLeagues,
    syncTrending,
    syncNFLState,
    syncMatchups,
    syncTransactions,
    addLeague,
    syncRosters
} from '../services/sync.service.js';
import { getSchedulerStatus } from '../services/scheduler.service.js';

const router = Router();

// ========================
// HEALTH & STATUS
// ========================

router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/status', (req: Request, res: Response) => {
    const nflState = queryOne('SELECT * FROM nfl_state WHERE id = 1');
    const leagueCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM leagues WHERE is_active = 1');
    const playerCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM players');
    const lastSync = queryOne('SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 1');
    const scheduler = getSchedulerStatus();

    res.json({
        nflState,
        leagues: leagueCount?.count || 0,
        players: playerCount?.count || 0,
        lastSync,
        scheduler
    });
});

router.get('/nfl-state', (req: Request, res: Response) => {
    const nflState = queryOne('SELECT * FROM nfl_state WHERE id = 1');
    res.json(nflState);
});

// ========================
// USERS
// ========================

router.get('/users/search/:username', async (req: Request, res: Response) => {
    try {
        const user = await sleeperApi.getUser(req.params.username);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/users/:userId/leagues/:season', async (req: Request, res: Response) => {
    try {
        const leagues = await sleeperApi.getUserLeagues(req.params.userId, req.params.season);

        // Check which leagues are already imported
        if (leagues.length > 0) {
            const leagueIds = leagues.map(l => l.league_id);
            const placeholders = leagueIds.map(() => '?').join(',');

            const imported = query(
                `SELECT league_id FROM leagues WHERE league_id IN (${placeholders})`,
                leagueIds
            ) as { league_id: string }[];

            const importedSet = new Set(imported.map(i => i.league_id));

            const enrichedLeagues = leagues.map(l => ({
                ...l,
                is_imported: importedSet.has(l.league_id)
            }));

            return res.json({ data: enrichedLeagues });
        }

        res.json({ data: leagues });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/users/imported', async (req: Request, res: Response) => {
    try {
        const users = query<SleeperUser>(`
            SELECT su.* 
            FROM sleeper_users su
            WHERE EXISTS (SELECT 1 FROM rosters WHERE owner_id = su.user_id)
            ORDER BY su.display_name ASC
        `);

        // Get the current NFL season from state
        const state = queryOne<{ season: string, league_season: string, league_create_season: string }>('SELECT season, league_season, league_create_season FROM nfl_state WHERE id = 1');
        const currentSeason = state?.league_season || state?.league_create_season || state?.season || '2024';

        // Enhance users with real-time Sleeper counts and local imported counts
        const enhancedUsers = await Promise.all(users.map(async (u) => {
            let sleeperCount = 0;
            try {
                const sleeperLeagues = await sleeperApi.getUserLeagues(u.user_id, currentSeason);
                sleeperCount = sleeperLeagues.length;

                // If no leagues in league_season, try regular season for transition period
                if (sleeperCount === 0 && state?.season && state.season !== currentSeason) {
                    const altLeagues = await sleeperApi.getUserLeagues(u.user_id, state.season);
                    sleeperCount = altLeagues.length;
                }
            } catch (e) {
                console.error(`Error fetching Sleeper leagues for ${u.display_name}:`, e);
            }

            const importedCount = queryOne<{ c: number }>(
                `SELECT COUNT(DISTINCT l.name) as c 
                 FROM rosters r 
                 JOIN leagues l ON r.league_id = l.league_id 
                 WHERE r.owner_id = ?`,
                [u.user_id]
            )?.c || 0;

            return {
                ...u,
                sleeper_leagues: sleeperCount,
                imported_leagues: importedCount
            };
        }));

        res.json({ data: enhancedUsers });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ========================
// PLAYERS
// ========================

router.get('/players', (req: Request, res: Response) => {
    const { search, position, team, limit = 50, offset = 0, sortBy = 'rank' } = req.query;

    let sql = 'SELECT * FROM players WHERE 1=1';
    const params: unknown[] = [];

    if (search) {
        sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR full_name LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    if (position) {
        sql += ' AND position = ?';
        params.push(position);
    }

    if (team) {
        sql += ' AND team = ?';
        params.push(team);
    }

    if (sortBy === 'position') {
        sql += ` ORDER BY 
            CASE position 
                WHEN 'QB' THEN 1 
                WHEN 'RB' THEN 2 
                WHEN 'WR' THEN 3 
                WHEN 'TE' THEN 4 
                WHEN 'K' THEN 5 
                WHEN 'DEF' THEN 6 
                WHEN 'DL' THEN 7 
                WHEN 'LB' THEN 8 
                WHEN 'DB' THEN 9 
                ELSE 99 
            END, search_rank ASC NULLS LAST`;
    } else {
        sql += ' ORDER BY search_rank ASC NULLS LAST';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const players = query(sql, params);
    res.json({ data: players, count: players.length });
});

router.get('/players/search', (req: Request, res: Response) => {
    const { q } = req.query;
    if (!q || String(q).length < 2) return res.json({ data: [] });

    const players = query(`
        SELECT player_id, full_name, position, team 
        FROM players 
        WHERE full_name LIKE ? OR first_name LIKE ? OR last_name LIKE ?
        LIMIT 10
    `, [`%${q}%`, `%${q}%`, `%${q}%`]);

    res.json({ data: players });
});

router.get('/players/:playerId', (req: Request, res: Response) => {
    const player = queryOne('SELECT * FROM players WHERE player_id = ?', [req.params.playerId]);
    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
});

router.get('/players/trending/:type', (req: Request, res: Response) => {
    const { type } = req.params;
    if (type !== 'add' && type !== 'drop') {
        return res.status(400).json({ error: 'Type must be "add" or "drop"' });
    }

    const trending = query(`
    SELECT tp.*, p.first_name, p.last_name, p.position, p.team
    FROM trending_players tp
    LEFT JOIN players p ON tp.player_id = p.player_id
    WHERE tp.trend_type = ?
    ORDER BY tp.count DESC, tp.fetched_at DESC
    LIMIT 50
  `, [type]);

    res.json({ data: trending });
});

// ========================
// LEAGUES
// ========================

router.get('/leagues', (req: Request, res: Response) => {
    const { ownerName, grouped } = req.query;

    if (grouped === 'true') {
        let sql = `
            SELECT 
                l.name,
                COUNT(*) as season_count,
                MIN(l.season) as start_year,
                MAX(l.season) as end_year,
                (SELECT league_id FROM leagues l2 WHERE l2.name = l.name ORDER BY l2.season DESC LIMIT 1) as league_id,
                (SELECT total_rosters FROM leagues l2 WHERE l2.name = l.name ORDER BY l2.season DESC LIMIT 1) as total_rosters,
                (SELECT status FROM leagues l2 WHERE l2.name = l.name ORDER BY l2.season DESC LIMIT 1) as status,
                (SELECT avatar FROM leagues l2 WHERE l2.name = l.name ORDER BY l2.season DESC LIMIT 1) as avatar
            FROM leagues l
            WHERE l.is_active = 1
        `;
        const params: any[] = [];

        if (ownerName) {
            sql += ` AND l.league_id IN (
                SELECT DISTINCT r.league_id 
                FROM rosters r
                JOIN sleeper_users su ON r.owner_id = su.user_id
                WHERE su.display_name LIKE ? OR su.username LIKE ?
            )`;
            params.push(`%${ownerName}%`, `%${ownerName}%`);
        }

        sql += ' GROUP BY l.name ORDER BY l.name';
        const leagues = query(sql, params);
        return res.json({ data: leagues });
    }

    let sql = 'SELECT l.* FROM leagues l WHERE l.is_active = 1';
    const params: any[] = [];

    if (ownerName) {
        sql = `
            SELECT DISTINCT l.* 
            FROM leagues l
            JOIN rosters r ON l.league_id = r.league_id
            JOIN sleeper_users su ON r.owner_id = su.user_id
            WHERE l.is_active = 1 AND (su.display_name LIKE ? OR su.username LIKE ?)
        `;
        params.push(`%${ownerName}%`, `%${ownerName}%`);
    }

    sql += ' ORDER BY l.name, l.season DESC';
    const leagues = query(sql, params);
    res.json({ data: leagues });
});

router.get('/leagues/imported-names', (req: Request, res: Response) => {
    const names = query('SELECT DISTINCT name FROM leagues ORDER BY name ASC');
    res.json({ data: names });
});

router.post('/leagues', async (req: Request, res: Response) => {
    try {
        const { leagueId } = req.body;
        if (!leagueId) {
            return res.status(400).json({ error: 'leagueId is required' });
        }

        // Check if league exists in Sleeper
        const league = await sleeperApi.getLeague(leagueId);
        if (!league) {
            return res.status(404).json({ error: 'League not found in Sleeper' });
        }

        // Add and sync the league
        await addLeague(leagueId);

        const savedLeague = queryOne('SELECT * FROM leagues WHERE league_id = ?', [leagueId]);
        res.status(201).json({ message: 'League added successfully', data: savedLeague });
    } catch (error: any) {
        console.error('Error adding league:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/leagues/bulk', async (req: Request, res: Response) => {
    try {
        const { leagueIds, syncHistory = false } = req.body;
        if (!Array.isArray(leagueIds)) {
            return res.status(400).json({ error: 'leagueIds must be an array' });
        }

        const results = [];
        for (const id of leagueIds) {
            try {
                await addLeague(id, syncHistory);
                results.push({ id, status: 'success' });
            } catch (err: any) {
                results.push({ id, status: 'error', error: err.message });
            }
        }

        res.json({ results });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/leagues/:leagueId', async (req: Request, res: Response) => {
    try {
        const { leagueId } = req.params;

        // Manual cleanup for tables that might not cascade perfectly
        execute('DELETE FROM drafts WHERE league_id = ?', [leagueId]);

        // Main deletion - triggers CASCADE
        const result = execute('DELETE FROM leagues WHERE league_id = ?', [leagueId]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'League not found' });
        }

        res.json({ message: 'League and all associated data deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting league:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/leagues/:leagueId', (req: Request, res: Response) => {
    const league = queryOne('SELECT * FROM leagues WHERE league_id = ?', [req.params.leagueId]);
    if (!league) {
        return res.status(404).json({ error: 'League not found' });
    }
    res.json(league);
});

router.get('/leagues/:leagueId/history', (req: Request, res: Response) => {
    const { leagueId } = req.params;

    // Find all seasons that are linked to this one
    // We'll build the set of inclusive league IDs
    const historyIds = new Set<string>();

    // 1. Go backwards
    let currentId: string | null = leagueId;
    while (currentId) {
        historyIds.add(currentId);
        const l = queryOne('SELECT previous_league_id FROM leagues WHERE league_id = ?', [currentId]) as any;
        currentId = (l?.previous_league_id && l.previous_league_id !== '0') ? l.previous_league_id : null;
        if (currentId && historyIds.has(currentId)) break; // Circular prevent
    }

    // 2. Go forwards (find any league that points to one of our current known IDs)
    let foundNew = true;
    while (foundNew) {
        foundNew = false;
        const currentIds = Array.from(historyIds);
        if (currentIds.length === 0) break;

        const placeholders = currentIds.map(() => '?').join(',');
        const nextLeagues = query(
            `SELECT league_id FROM leagues WHERE previous_league_id IN (${placeholders})`,
            currentIds
        ) as any[];

        for (const nl of nextLeagues) {
            if (!historyIds.has(nl.league_id)) {
                historyIds.add(nl.league_id);
                foundNew = true;
            }
        }
    }

    // 3. Fetch full details for all found IDs
    const ids = Array.from(historyIds);
    const placeholders = ids.map(() => '?').join(',');
    const history = query(
        `SELECT league_id, name, season, status, previous_league_id 
         FROM leagues 
         WHERE league_id IN (${placeholders}) 
         ORDER BY season DESC`,
        ids
    );

    res.json({ data: history });
});

router.delete('/leagues/:leagueId', (req: Request, res: Response) => {
    const { leagueId } = req.params;
    const league = queryOne('SELECT * FROM leagues WHERE league_id = ?', [leagueId]);
    if (!league) {
        return res.status(404).json({ error: 'League not found' });
    }

    // Soft delete (mark as inactive)
    query('UPDATE leagues SET is_active = 0 WHERE league_id = ?', [leagueId]);
    res.json({ message: 'League removed from tracking' });
});

// ========================
// ROSTERS
// ========================

router.get('/leagues/:leagueId/rosters', (req: Request, res: Response) => {
    const rosters = query(`
    SELECT r.*, su.username, su.display_name as owner_name, su.avatar as owner_avatar
    FROM rosters r
    LEFT JOIN sleeper_users su ON r.owner_id = su.user_id
    WHERE r.league_id = ?
    ORDER BY r.roster_id
  `, [req.params.leagueId]);

    res.json({ data: rosters });
});

router.get('/leagues/:leagueId/rosters/:rosterId', (req: Request, res: Response) => {
    const roster = queryOne(`
    SELECT r.*, su.username, su.display_name as owner_name
    FROM rosters r
    LEFT JOIN sleeper_users su ON r.owner_id = su.user_id
    WHERE r.league_id = ? AND r.roster_id = ?
  `, [req.params.leagueId, req.params.rosterId]);

    if (!roster) {
        return res.status(404).json({ error: 'Roster not found' });
    }
    res.json(roster);
});

// Get roster players with full info, sorted by position then ranking
router.get('/leagues/:leagueId/rosters/:rosterId/players', (req: Request, res: Response) => {
    const { leagueId, rosterId } = req.params;

    const roster = queryOne<{ players: string; starters: string }>(`
    SELECT players, starters FROM rosters
    WHERE league_id = ? AND roster_id = ?
  `, [leagueId, rosterId]);

    if (!roster) {
        return res.status(404).json({ error: 'Roster not found' });
    }

    try {
        const playerIds = JSON.parse(roster.players || '[]') as string[];
        const starterIds = JSON.parse(roster.starters || '[]') as string[];

        // 1. Get traded picks for this roster
        const tradedPicks = query<{
            season: string;
            round: number;
            original_owner_id: number;
            owner_name: string;
        }>(`
            SELECT tp.*, su.display_name as owner_name
            FROM traded_picks tp
            LEFT JOIN rosters r ON tp.league_id = r.league_id AND tp.original_owner_id = r.roster_id
            LEFT JOIN sleeper_users su ON r.owner_id = su.user_id
            WHERE tp.league_id = ? AND tp.current_owner_id = ?
        `, [leagueId, rosterId]);

        // Map picks to "player-like" objects
        const pickItems = tradedPicks.map(p => ({
            player_id: `pick_${p.season}_${p.round}_${p.original_owner_id}`,
            full_name: `${p.season} Round ${p.round} (${p.owner_name})`,
            position: 'PICK',
            team: 'DRAFT',
            is_pick: true,
            pick_season: p.season,
            pick_round: p.round,
            original_owner_name: p.owner_name,
            search_rank: 99999 + p.round // Lower rounds at the end
        }));

        if (playerIds.length === 0 && pickItems.length === 0) {
            return res.json({ data: [], starters: [] });
        }

        // 2. Get players
        let players: any[] = [];
        if (playerIds.length > 0) {
            const placeholders = playerIds.map(() => '?').join(',');
            players = query(`
                SELECT player_id, first_name, last_name, full_name, position, team, 
                       age, status, injury_status, search_rank, years_exp, college,
                       jersey_number, depth_chart_order
                FROM players 
                WHERE player_id IN (${placeholders})
            `, playerIds);
        }

        // Position priority order for fantasy
        const positionOrder: Record<string, number> = {
            'QB': 1, 'RB': 2, 'WR': 3, 'TE': 4, 'K': 5, 'DEF': 6,
            'DL': 7, 'LB': 8, 'DB': 9, 'PICK': 100 // Picks always last
        };

        // Combine and Sort
        const allItems = [...players, ...pickItems];
        const sortedItems = allItems.sort((a, b) => {
            const posA = positionOrder[a.position] || 99;
            const posB = positionOrder[b.position] || 99;
            if (posA !== posB) return posA - posB;

            const rankA = a.search_rank || 9999;
            const rankB = b.search_rank || 9999;
            return rankA - rankB;
        });

        // Mark starters
        const finalData = sortedItems.map(p => ({
            ...p,
            is_starter: starterIds.includes(p.player_id)
        }));

        res.json({ data: finalData, starters: starterIds });
    } catch (error) {
        console.error('Error fetching roster players/picks:', error);
        res.json({ data: [], starters: [] });
    }
});

// ========================
// MATCHUPS
// ========================

router.get('/leagues/:leagueId/matchups/:week', (req: Request, res: Response) => {
    const matchups = query(`
    SELECT m.*, r.owner_id, su.display_name as owner_name
    FROM matchups m
    LEFT JOIN rosters r ON m.league_id = r.league_id AND m.roster_id = r.roster_id
    LEFT JOIN sleeper_users su ON r.owner_id = su.user_id
    WHERE m.league_id = ? AND m.week = ?
    ORDER BY m.matchup_id, m.roster_id
  `, [req.params.leagueId, req.params.week]);

    res.json({ data: matchups });
});

// ========================
// TRANSACTIONS / TRADES
// ========================

// Global trades endpoint with advanced filtering
router.get('/trades', (req: Request, res: Response) => {
    try {
        const { leagueId, leagueName, ownerName, managerId, playerName, position, limit = 50, offset = 0 } = req.query;

        let sql = `
        SELECT t.*, l.name as league_name, l.season
        FROM transactions t
        JOIN leagues l ON t.league_id = l.league_id
        WHERE t.type = 'trade' AND t.status = 'complete'
    `;
        const params: unknown[] = [];

        // Support both leagueId (exact) and leagueName (by name)
        if (leagueId) {
            sql += ' AND t.league_id = ?';
            params.push(leagueId);
        } else if (leagueName) {
            sql += ' AND l.name = ?';
            params.push(leagueName);
        }

        if (managerId) {
            // Robust filtering for roster_ids JSON array
            sql += ` AND EXISTS (
            SELECT 1 FROM json_each(t.roster_ids) 
            WHERE CAST(value AS TEXT) = (
                SELECT CAST(roster_id AS TEXT) FROM rosters WHERE owner_id = ? AND league_id = t.league_id
            )
        )`;
            params.push(managerId);
        } else if (ownerName) {
            const rosters = query(`
            SELECT DISTINCT r.roster_id, r.league_id 
            FROM rosters r 
            JOIN sleeper_users su ON r.owner_id = su.user_id 
            WHERE su.display_name LIKE ? OR su.username LIKE ?
        `, [`%${ownerName}%`, `%${ownerName}%`]) as any[];

            if (rosters.length > 0) {
                const rosterFilters = rosters.map(r => `(t.league_id = '${r.league_id}' AND EXISTS (SELECT 1 FROM json_each(t.roster_ids) WHERE CAST(value AS TEXT) = '${r.roster_id}'))`).join(' OR ');
                sql += ` AND (${rosterFilters})`;
            } else {
                sql += ' AND 1 = 0';
            }
        }

        if (playerName) {
            const pids = query(`
            SELECT player_id FROM players 
            WHERE full_name LIKE ? OR first_name LIKE ? OR last_name LIKE ?
        `, [`%${playerName}%`, `%${playerName}%`, `%${playerName}%`]) as any[];

            if (pids.length > 0) {
                // Build paths directly - can't use params with json_extract paths
                const playerFilters = pids.map(p =>
                    `(json_extract(t.adds, '$.${p.player_id}') IS NOT NULL OR json_extract(t.drops, '$.${p.player_id}') IS NOT NULL)`
                ).join(' OR ');
                sql += ` AND (${playerFilters})`;
            } else {
                sql += ' AND 1 = 0';
            }
        }

        if (position) {
            sql += ` AND EXISTS (
            SELECT 1 FROM json_each(t.adds) as je
            JOIN players p ON je.key = p.player_id
            WHERE p.position = ?
        )`;
            params.push(position);
        }

        sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));

        const trades = query(sql, params) as any[];

        // Collect all relevant IDs for name resolution
        const playerIds = new Set<string>();
        const leagueRosterKeys = new Set<string>(); // "leagueId:rosterId"

        trades.forEach(t => {
            const adds = JSON.parse(t.adds || '{}') || {};
            const drops = JSON.parse(t.drops || '{}') || {};
            const rosterIds = JSON.parse(t.roster_ids || '[]') || [];
            const picks = JSON.parse(t.draft_picks || '[]') || [];

            Object.keys(adds).forEach(id => playerIds.add(id));
            Object.keys(drops).forEach(id => playerIds.add(id));
            rosterIds.forEach((rid: any) => leagueRosterKeys.add(`${t.league_id}:${rid}`));
            picks.forEach((p: any) => {
                if (p.owner_id) leagueRosterKeys.add(`${t.league_id}:${p.owner_id}`);
                if (p.previous_owner_id) leagueRosterKeys.add(`${t.league_id}:${p.previous_owner_id}`);
                if (p.roster_id) leagueRosterKeys.add(`${t.league_id}:${p.roster_id}`); // Original owner
            });
        });

        // Fetch Player Info
        const playerMap: Record<string, any> = {};
        if (playerIds.size > 0) {
            const ids = Array.from(playerIds);
            const placeholders = ids.map(() => '?').join(',');
            const players = query(`SELECT player_id, full_name, position, team FROM players WHERE player_id IN (${placeholders})`, ids);
            players.forEach((p: any) => {
                playerMap[p.player_id] = p;
            });
        }

        // Fetch Roster/User names
        const rosterMap: Record<string, any> = {};
        if (leagueRosterKeys.size > 0) {
            // Since we need cross-league resolution, we'll fetch unique owner names by joining rosters/users
            const uniqueKeys = Array.from(leagueRosterKeys);
            // We can't easily join on "league_id:roster_id" in one SQL if it's many, 
            // but we can fetch all rosters for the relevant leagues and build a map.
            const relevantLeagues = Array.from(new Set(trades.map(t => t.league_id)));
            const placeholders = relevantLeagues.map(() => '?').join(',');

            const rostersData = query(`
            SELECT r.league_id, r.roster_id, su.display_name as owner_name, su.username
            FROM rosters r
            LEFT JOIN sleeper_users su ON r.owner_id = su.user_id
            WHERE r.league_id IN (${placeholders})
        `, relevantLeagues) as any[];

            rostersData.forEach(r => {
                rosterMap[`${r.league_id}:${r.roster_id}`] = {
                    owner_name: r.owner_name || `Time ${r.roster_id}`,
                    username: r.username
                };
            });
        }

        const parsedTrades = trades.map(t => {
            const rawPicks = JSON.parse(t.draft_picks || '[]') || [];
            const draft_picks = Array.isArray(rawPicks) ? rawPicks : [];

            draft_picks.sort((a: any, b: any) => {
                if (a && b && a.season && b.season) {
                    if (a.season !== b.season) return a.season.localeCompare(b.season);
                }
                return (a.round || 0) - (b.round || 0);
            });

            // Inject display names into picks
            const enrichedPicks = draft_picks.map((p: any) => {
                if (!p) return p;
                const ownerKey = `${t.league_id}:${p.owner_id}`;
                const originalOwnerKey = `${t.league_id}:${p.roster_id}`; // roster_id = original owner

                return {
                    ...p,
                    owner_name: rosterMap[ownerKey]?.owner_name || `Time ${p.owner_id}`,
                    org_owner_name: rosterMap[originalOwnerKey]?.owner_name || `Time ${p.roster_id}`
                };
            });

            return {
                ...t,
                roster_ids: JSON.parse(t.roster_ids || '[]') || [],
                adds: JSON.parse(t.adds || '{}') || {},
                drops: JSON.parse(t.drops || '{}') || {},
                draft_picks: enrichedPicks,
                metadata: JSON.parse(t.metadata || '{}') || {}
            };
        });

        res.json({
            data: parsedTrades,
            players: playerMap,
            rosters: rosterMap
        });
    } catch (error: any) {
        console.error('Error in /trades endpoint:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ========================
// PLAYOFF BRACKETS
// ========================

router.get('/leagues/:leagueId/brackets/:type', (req: Request, res: Response) => {
    const { type } = req.params;
    if (type !== 'winners' && type !== 'losers') {
        return res.status(400).json({ error: 'Type must be "winners" or "losers"' });
    }

    const brackets = query(`
    SELECT * FROM playoff_brackets
    WHERE league_id = ? AND bracket_type = ?
    ORDER BY round, match_id
  `, [req.params.leagueId, type]);

    res.json({ data: brackets });
});

// ========================
// DRAFTS
// ========================

router.get('/drafts', (req: Request, res: Response) => {
    try {
        const { leagueId, leagueName, season, status } = req.query;

        let sql = `
            SELECT d.*, l.name as league_name
            FROM drafts d
            JOIN leagues l ON d.league_id = l.league_id
            WHERE 1=1
        `;
        const params: unknown[] = [];

        if (leagueId) {
            sql += ' AND d.league_id = ?';
            params.push(leagueId);
        }

        if (leagueName) {
            sql += ' AND l.name = ?';
            params.push(leagueName);
        }

        if (season) {
            sql += ' AND d.season = ?';
            params.push(season);
        }

        if (status) {
            sql += ' AND d.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY d.season DESC, d.start_time DESC';

        const drafts = query(sql, params);

        // Parse JSON fields
        const parsedDrafts = drafts.map((d: any) => ({
            ...d,
            settings: JSON.parse(d.settings || '{}'),
            metadata: JSON.parse(d.metadata || '{}')
        }));

        res.json({ data: parsedDrafts });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/users/:userId/drafts/:season', async (req: Request, res: Response) => {
    try {
        const { userId, season } = req.params;
        const drafts = await sleeperApi.getUserDrafts(userId, 'nfl', season);
        res.json({ data: drafts });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/leagues/:leagueId/drafts', (req: Request, res: Response) => {
    const drafts = query('SELECT * FROM drafts WHERE league_id = ?', [req.params.leagueId]);

    const parsedDrafts = drafts.map((d: any) => ({
        ...d,
        settings: JSON.parse(d.settings || '{}'),
        draft_order: JSON.parse(d.draft_order || '{}'),
        slot_to_roster_id: JSON.parse(d.slot_to_roster_id || '{}'),
        metadata: JSON.parse(d.metadata || '{}')
    }));

    res.json({ data: parsedDrafts });
});

router.get('/drafts/:draftId', (req: Request, res: Response) => {
    const draft = queryOne('SELECT d.*, l.name as league_name FROM drafts d LEFT JOIN leagues l ON d.league_id = l.league_id WHERE d.draft_id = ?', [req.params.draftId]);

    if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
    }

    const parsed = {
        ...(draft as any),
        settings: JSON.parse((draft as any).settings || '{}'),
        draft_order: JSON.parse((draft as any).draft_order || '{}'),
        slot_to_roster_id: JSON.parse((draft as any).slot_to_roster_id || '{}'),
        metadata: JSON.parse((draft as any).metadata || '{}')
    };

    res.json(parsed);
});

router.get('/drafts/:draftId/picks', (req: Request, res: Response) => {
    const picks = query(`
    SELECT dp.*, p.first_name, p.last_name, p.position, p.team, p.search_rank
    FROM draft_picks dp
    LEFT JOIN players p ON dp.player_id = p.player_id
    WHERE dp.draft_id = ?
    ORDER BY dp.pick_no
  `, [req.params.draftId]);

    res.json({ data: picks });
});

router.get('/drafts/:draftId/analysis', async (req: Request, res: Response) => {
    try {
        const { getDraftAnalysis } = await import('../services/draft-analytics.service.js');
        const analysis = await getDraftAnalysis(req.params.draftId);

        if (!analysis) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        res.json(analysis);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/drafts/:draftId/board', async (req: Request, res: Response) => {
    try {
        const { getDraftBoard } = await import('../services/draft-analytics.service.js');
        const board = await getDraftBoard(req.params.draftId);

        if (!board) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        res.json(board);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/users/:userId/tendencies', async (req: Request, res: Response) => {
    try {
        const { getManagerTendencies } = await import('../services/draft-analytics.service.js');
        const tendencies = await getManagerTendencies(req.params.userId);

        if (!tendencies) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(tendencies);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ========================
// NFL STATE
// ========================

router.get('/nfl/state', (req: Request, res: Response) => {
    const state = queryOne('SELECT * FROM nfl_state WHERE id = 1');
    res.json(state);
});

// ========================
// SYNC ENDPOINTS (Manual triggers)
// ========================

router.post('/sync/nfl-state', async (req: Request, res: Response) => {
    try {
        await syncNFLState();
        const state = queryOne('SELECT * FROM nfl_state WHERE id = 1');
        res.json({ message: 'NFL state synced', data: state });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sync/players', async (req: Request, res: Response) => {
    try {
        const count = await syncPlayers();
        res.json({ message: 'Players synced', count });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sync/trending', async (req: Request, res: Response) => {
    try {
        await syncTrending();
        res.json({ message: 'Trending players synced' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sync/leagues', async (req: Request, res: Response) => {
    try {
        await syncAllLeagues();
        res.json({ message: 'All leagues synced' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Alias for frontend compatibility
router.post('/sync/all-leagues', async (req: Request, res: Response) => {
    try {
        syncAllLeagues().catch(err => console.error('Background sync all failed:', err));
        res.json({ message: 'Global sync started' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to start global sync' });
    }
});

router.post('/sync/league/:leagueId', async (req: Request, res: Response) => {
    try {
        await syncLeague(req.params.leagueId);
        res.json({ message: `League ${req.params.leagueId} synced` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sync/league/:leagueId/matchups/:week', async (req: Request, res: Response) => {
    try {
        await syncMatchups(req.params.leagueId, Number(req.params.week));
        res.json({ message: `Matchups synced for week ${req.params.week}` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sync/league/:leagueId/transactions/:week', async (req: Request, res: Response) => {
    try {
        await syncTransactions(req.params.leagueId, Number(req.params.week));
        res.json({ message: `Transactions synced for week ${req.params.week}` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ========================
// SYNC LOGS
// ========================

router.get('/sync/logs', (req: Request, res: Response) => {
    const { limit = 50, type } = req.query;

    let sql = 'SELECT * FROM sync_logs';
    const params: unknown[] = [];

    if (type) {
        sql += ' WHERE sync_type = ?';
        params.push(type);
    }

    sql += ' ORDER BY started_at DESC LIMIT ?';
    params.push(Number(limit));

    const logs = query(sql, params);
    res.json({ data: logs });
});

export default router;
