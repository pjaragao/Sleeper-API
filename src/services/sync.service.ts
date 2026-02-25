import { getDb, execute, query, queryOne } from '../config/database.js';
import {
    sleeperApi,
    SleeperLeague,
    SleeperRoster,
    SleeperUser,
    SleeperMatchup,
    SleeperTransaction,
    SleeperPlayoffBracket,
    SleeperTradedPick,
    SleeperDraft,
    SleeperDraftPick,
    SleeperPlayer,
    SleeperNFLState
} from './sleeper-api.service.js';

type SyncType = 'players' | 'leagues' | 'rosters' | 'matchups' | 'transactions' |
    'trending' | 'nfl_state' | 'playoff_brackets' | 'traded_picks' | 'drafts' | 'draft_picks';

// ========================
// SYNC LOG HELPERS
// ========================

function startSyncLog(syncType: SyncType, leagueId?: string): number {
    const result = execute(
        'INSERT INTO sync_logs (sync_type, league_id, status) VALUES (?, ?, ?)',
        [syncType, leagueId || null, 'started']
    );
    return Number(result.lastInsertRowid);
}

function completeSyncLog(logId: number, recordsProcessed: number): void {
    execute(
        "UPDATE sync_logs SET status = ?, records_processed = ?, completed_at = datetime('now') WHERE id = ?",
        ['completed', recordsProcessed, logId]
    );
}

function failSyncLog(logId: number, errorMessage: string): void {
    execute(
        "UPDATE sync_logs SET status = ?, error_message = ?, completed_at = datetime('now') WHERE id = ?",
        ['failed', errorMessage, logId]
    );
}

// ========================
// NFL STATE SYNC
// ========================

export async function syncNFLState(): Promise<void> {
    console.log('📅 Syncing NFL state...');
    const logId = startSyncLog('nfl_state');

    try {
        const state = await sleeperApi.getNFLState();

        execute(
            `UPDATE nfl_state SET 
        week = ?, season = ?, season_type = ?, season_start_date = ?,
        display_week = ?, leg = ?, league_season = ?, league_create_season = ?,
        previous_season = ?, updated_at = datetime('now')
       WHERE id = 1`,
            [
                state.week, state.season, state.season_type, state.season_start_date,
                state.display_week, state.leg, state.league_season, state.league_create_season,
                state.previous_season
            ]
        );

        completeSyncLog(logId, 1);
        console.log(`✅ NFL state synced: Week ${state.week}, Season ${state.season}`);
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// PLAYERS SYNC
// ========================

export async function syncPlayers(): Promise<number> {
    console.log('🏈 Syncing all NFL players...');
    const logId = startSyncLog('players');

    try {
        const players = await sleeperApi.getAllPlayers();
        const playerIds = Object.keys(players);
        let processed = 0;

        const db = getDb();
        const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO players (
        player_id, first_name, last_name, position, team, age, years_exp,
        college, weight, height, jersey_number, depth_chart_position, depth_chart_order,
        status, injury_status, injury_start_date, practice_participation,
        fantasy_positions, search_rank, search_first_name, search_last_name,
        search_full_name, hashtag, sport, birth_country, espn_id, yahoo_id,
        rotowire_id, rotoworld_id, stats_id, sportradar_id, fantasy_data_id,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

        // Use transaction for bulk insert
        const insertMany = db.transaction((playerBatch: string[]) => {
            for (const id of playerBatch) {
                const p = players[id];
                insertStmt.run(
                    p.player_id || id,
                    p.first_name,
                    p.last_name,
                    p.position,
                    p.team,
                    p.age,
                    p.years_exp,
                    p.college,
                    p.weight,
                    p.height,
                    p.number,
                    p.depth_chart_position,
                    p.depth_chart_order,
                    p.status,
                    p.injury_status,
                    p.injury_start_date,
                    p.practice_participation,
                    JSON.stringify(p.fantasy_positions || []),
                    p.search_rank,
                    p.search_first_name,
                    p.search_last_name,
                    p.search_full_name,
                    p.hashtag,
                    p.sport || 'nfl',
                    p.birth_country,
                    p.espn_id,
                    p.yahoo_id,
                    p.rotowire_id,
                    p.rotoworld_id,
                    p.stats_id,
                    p.sportradar_id,
                    p.fantasy_data_id
                );
            }
        });

        // Process in batches of 1000
        const batchSize = 1000;
        for (let i = 0; i < playerIds.length; i += batchSize) {
            const batch = playerIds.slice(i, i + batchSize);
            insertMany(batch);
            processed += batch.length;
            console.log(`   Processed ${processed}/${playerIds.length} players...`);
        }

        completeSyncLog(logId, processed);
        console.log(`✅ Players sync complete: ${processed} players`);
        return processed;
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// SLEEPER USER SYNC
// ========================

function upsertSleeperUser(user: SleeperUser): void {
    execute(
        `INSERT OR REPLACE INTO sleeper_users (user_id, username, display_name, avatar, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
        [user.user_id, user.username, user.display_name, user.avatar]
    );
}

// ========================
// LEAGUE SYNC
// ========================

export async function syncLeague(leagueId: string): Promise<SleeperLeague> {
    console.log(`📊 Syncing league ${leagueId}...`);
    const logId = startSyncLog('leagues', leagueId);

    try {
        // 1. Get league info
        const league = await sleeperApi.getLeague(leagueId);

        execute(
            `INSERT OR REPLACE INTO leagues (
        league_id, name, season, season_type, status, sport, total_rosters,
        avatar, scoring_settings, roster_positions, settings, draft_id, 
        previous_league_id, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
            [
                league.league_id, league.name, league.season, league.season_type,
                league.status, league.sport, league.total_rosters, league.avatar,
                JSON.stringify(league.scoring_settings), JSON.stringify(league.roster_positions),
                JSON.stringify(league.settings), league.draft_id, league.previous_league_id
            ]
        );

        // 2. Sync league users
        const users = await sleeperApi.getLeagueUsers(leagueId);
        for (const user of users) {
            upsertSleeperUser(user);
            execute(
                `INSERT OR REPLACE INTO league_users (league_id, user_id, display_name, avatar, is_owner, updated_at)
         VALUES (?, ?, ?, ?, 0, datetime('now'))`,
                [leagueId, user.user_id, user.display_name, user.avatar]
            );
        }

        // 3. Sync rosters
        await syncRosters(leagueId);

        // 4. Sync playoff brackets
        await syncPlayoffBrackets(leagueId);

        // 5. Sync traded picks
        await syncTradedPicks(leagueId);

        // 6. Sync drafts
        await syncDrafts(leagueId);

        // 7. Sync transactions AND matchups for all weeks (1-18)
        console.log(`   🔄 Syncing history (transactions & matchups) for league ${leagueId}...`);
        for (let week = 1; week <= 18; week++) {
            await syncTransactions(leagueId, week);
            await syncMatchups(leagueId, week);
        }

        completeSyncLog(logId, 1);
        console.log(`✅ League ${league.name} synced successfully`);
        return league;
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// ROSTERS SYNC
// ========================

export async function syncRosters(leagueId: string): Promise<void> {
    console.log(`   📋 Syncing rosters for ${leagueId}...`);
    const logId = startSyncLog('rosters', leagueId);

    try {
        const rosters = await sleeperApi.getRosters(leagueId);

        for (const r of rosters) {
            execute(
                `INSERT OR REPLACE INTO rosters (
          league_id, roster_id, owner_id, co_owners, players, starters, reserve, taxi,
          wins, losses, ties, fpts, fpts_decimal, fpts_against, fpts_against_decimal,
          waiver_position, waiver_budget_used, total_moves, settings, metadata, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    leagueId, r.roster_id, r.owner_id, JSON.stringify(r.co_owners || []),
                    JSON.stringify(r.players || []), JSON.stringify(r.starters || []),
                    JSON.stringify(r.reserve || []), JSON.stringify(r.taxi || []),
                    r.settings?.wins || 0, r.settings?.losses || 0, r.settings?.ties || 0,
                    r.settings?.fpts || 0, r.settings?.fpts_decimal || 0,
                    r.settings?.fpts_against || 0, r.settings?.fpts_against_decimal || 0,
                    r.settings?.waiver_position || 0, r.settings?.waiver_budget_used || 0,
                    r.settings?.total_moves || 0, JSON.stringify(r.settings || {}),
                    JSON.stringify(r.metadata || {})
                ]
            );
        }

        completeSyncLog(logId, rosters.length);
        console.log(`   ✅ ${rosters.length} rosters synced`);
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// MATCHUPS SYNC
// ========================

export async function syncMatchups(leagueId: string, week: number): Promise<void> {
    console.log(`   🎯 Syncing matchups for ${leagueId} week ${week}...`);
    const logId = startSyncLog('matchups', leagueId);

    try {
        const matchups = await sleeperApi.getMatchups(leagueId, week);

        for (const m of matchups) {
            execute(
                `INSERT OR REPLACE INTO matchups (
          league_id, week, matchup_id, roster_id, starters, players,
          points, custom_points, starters_points, players_points, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    leagueId, week, m.matchup_id, m.roster_id,
                    JSON.stringify(m.starters || []), JSON.stringify(m.players || []),
                    m.points, m.custom_points,
                    JSON.stringify(m.starters_points || []), JSON.stringify(m.players_points || {})
                ]
            );
        }

        completeSyncLog(logId, matchups.length);
        console.log(`   ✅ ${matchups.length} matchups synced for week ${week}`);
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// TRANSACTIONS SYNC
// ========================

export async function syncTransactions(leagueId: string, week: number): Promise<void> {
    console.log(`   💱 Syncing transactions for ${leagueId} week ${week}...`);
    const logId = startSyncLog('transactions', leagueId);

    try {
        const transactions = await sleeperApi.getTransactions(leagueId, week);

        for (const t of transactions) {
            execute(
                `INSERT OR REPLACE INTO transactions (
          transaction_id, league_id, type, status, week, roster_ids, consenter_ids,
          creator_id, adds, drops, draft_picks, waiver_budget, settings, metadata,
          created_at, status_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    t.transaction_id, leagueId, t.type, t.status, t.leg,
                    JSON.stringify(t.roster_ids || []), JSON.stringify(t.consenter_ids || []),
                    t.creator, JSON.stringify(t.adds), JSON.stringify(t.drops),
                    JSON.stringify(t.draft_picks || []), JSON.stringify(t.waiver_budget || []),
                    JSON.stringify(t.settings || {}), JSON.stringify(t.metadata || {}),
                    t.created, t.status_updated
                ]
            );
        }

        completeSyncLog(logId, transactions.length);
        console.log(`   ✅ ${transactions.length} transactions synced for week ${week}`);
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// PLAYOFF BRACKETS SYNC
// ========================

export async function syncPlayoffBrackets(leagueId: string): Promise<void> {
    console.log(`   🏆 Syncing playoff brackets for ${leagueId}...`);
    const logId = startSyncLog('playoff_brackets', leagueId);

    try {
        // Clear existing brackets
        execute('DELETE FROM playoff_brackets WHERE league_id = ?', [leagueId]);

        // Sync winners bracket
        const winners = await sleeperApi.getWinnersBracket(leagueId);
        for (const b of winners) {
            execute(
                `INSERT INTO playoff_brackets (
          league_id, bracket_type, round, match_id, team1_roster_id, team2_roster_id,
          team1_from, team2_from, winner_roster_id, loser_roster_id, placement
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    leagueId, 'winners', b.r, b.m, b.t1 || null, b.t2 || null,
                    JSON.stringify(b.t1_from || null), JSON.stringify(b.t2_from || null),
                    b.w || null, b.l || null, b.p || null
                ]
            );
        }

        // Sync losers bracket
        const losers = await sleeperApi.getLosersBracket(leagueId);
        for (const b of losers) {
            execute(
                `INSERT INTO playoff_brackets (
          league_id, bracket_type, round, match_id, team1_roster_id, team2_roster_id,
          team1_from, team2_from, winner_roster_id, loser_roster_id, placement
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    leagueId, 'losers', b.r, b.m, b.t1 || null, b.t2 || null,
                    JSON.stringify(b.t1_from || null), JSON.stringify(b.t2_from || null),
                    b.w || null, b.l || null, b.p || null
                ]
            );
        }

        completeSyncLog(logId, winners.length + losers.length);
        console.log(`   ✅ Playoff brackets synced (${winners.length} winners, ${losers.length} losers)`);
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// TRADED PICKS SYNC
// ========================

export async function syncTradedPicks(leagueId: string): Promise<void> {
    console.log(`   🔄 Syncing traded picks for ${leagueId}...`);
    const logId = startSyncLog('traded_picks', leagueId);

    try {
        const picks = await sleeperApi.getTradedPicks(leagueId);

        // Clear existing and insert fresh
        execute('DELETE FROM traded_picks WHERE league_id = ?', [leagueId]);

        for (const p of picks) {
            execute(
                `INSERT INTO traded_picks (
          league_id, season, round, original_owner_id, previous_owner_id, current_owner_id
        ) VALUES (?, ?, ?, ?, ?, ?)`,
                [leagueId, p.season, p.round, p.roster_id, p.previous_owner_id, p.owner_id]
            );
        }

        completeSyncLog(logId, picks.length);
        console.log(`   ✅ ${picks.length} traded picks synced`);
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// DRAFTS SYNC
// ========================

export async function syncDrafts(leagueId: string): Promise<void> {
    console.log(`   📝 Syncing drafts for ${leagueId}...`);
    const logId = startSyncLog('drafts', leagueId);

    try {
        const drafts = await sleeperApi.getDraftsForLeague(leagueId);

        for (const d of drafts) {
            execute(
                `INSERT OR REPLACE INTO drafts (
          draft_id, league_id, type, status, sport, season, season_type,
          settings, draft_order, slot_to_roster_id, metadata, creators,
          start_time, last_picked, last_message_time, last_message_id, created, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    d.draft_id, leagueId, d.type, d.status, d.sport, d.season, d.season_type,
                    JSON.stringify(d.settings || {}), JSON.stringify(d.draft_order || {}),
                    JSON.stringify(d.slot_to_roster_id || {}), JSON.stringify(d.metadata || {}),
                    JSON.stringify(d.creators), d.start_time, d.last_picked,
                    d.last_message_time, d.last_message_id, d.created
                ]
            );

            // Sync draft picks if draft is complete
            if (d.status === 'complete') {
                await syncDraftPicks(d.draft_id);
            }
        }

        completeSyncLog(logId, drafts.length);
        console.log(`   ✅ ${drafts.length} drafts synced`);
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// DRAFT PICKS SYNC
// ========================

export async function syncDraftPicks(draftId: string): Promise<void> {
    console.log(`      📌 Syncing picks for draft ${draftId}...`);
    const logId = startSyncLog('draft_picks');

    try {
        const picks = await sleeperApi.getDraftPicks(draftId);

        for (const p of picks) {
            execute(
                `INSERT OR REPLACE INTO draft_picks (
          draft_id, player_id, pick_no, round, draft_slot, picked_by, roster_id, is_keeper, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    draftId, p.player_id, p.pick_no, p.round, p.draft_slot,
                    p.picked_by, p.roster_id, p.is_keeper ? 1 : 0, JSON.stringify(p.metadata || {})
                ]
            );
        }

        completeSyncLog(logId, picks.length);
        console.log(`      ✅ ${picks.length} draft picks synced`);
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// TRENDING PLAYERS SYNC
// ========================

export async function syncTrending(): Promise<void> {
    console.log('📈 Syncing trending players...');
    const logId = startSyncLog('trending');

    try {
        // Get trending adds and drops
        const adds = await sleeperApi.getTrendingPlayers('add', 24, 50);
        const drops = await sleeperApi.getTrendingPlayers('drop', 24, 50);

        // Clear old trending data (older than 24 hours)
        execute(
            "DELETE FROM trending_players WHERE fetched_at < datetime('now', '-24 hours')"
        );

        // Insert new trending adds
        for (const p of adds) {
            execute(
                'INSERT INTO trending_players (player_id, trend_type, count) VALUES (?, ?, ?)',
                [p.player_id, 'add', p.count]
            );
        }

        // Insert new trending drops
        for (const p of drops) {
            execute(
                'INSERT INTO trending_players (player_id, trend_type, count) VALUES (?, ?, ?)',
                [p.player_id, 'drop', p.count]
            );
        }

        completeSyncLog(logId, adds.length + drops.length);
        console.log(`✅ Trending synced: ${adds.length} adds, ${drops.length} drops`);
    } catch (error: any) {
        failSyncLog(logId, error.message);
        throw error;
    }
}

// ========================
// SYNC ALL LEAGUES
// ========================

/**
 * Truly Global Sync:
 * 1. Refresh NFL State
 * 2. Discovery: Auto-import new seasons for existing managers
 * 3. Refresh Trending
 * 4. Refresh Players (if older than 24h)
 * 5. Sync all active leagues
 */
export async function syncAllLeagues(): Promise<void> {
    console.log('🔄 STARTING COMPREHENSIVE GLOBAL SYNC...');

    // 1. Update NFL State
    await syncNFLState();

    // 2. Trending
    await syncTrending();

    // 3. Players (Only if not synced recently)
    const lastPlayerSync = queryOne<{ started_at: string }>(
        "SELECT started_at FROM sync_logs WHERE type = 'players' AND status = 'completed' ORDER BY started_at DESC LIMIT 1"
    );
    const shouldSyncPlayers = !lastPlayerSync ||
        (new Date().getTime() - new Date(lastPlayerSync.started_at).getTime() > 24 * 60 * 60 * 1000);

    if (shouldSyncPlayers) {
        console.log('🏈 Player database update scheduled...');
        // We do this in background or as part of the flow? 
        // For "LITERALLY EVERYTHING", we do it now.
        await syncPlayers();
    }

    // 5. Sync all active leagues
    const activeLeagues = query<{ league_id: string, name: string }>(
        'SELECT league_id, name FROM leagues WHERE is_active = 1'
    );

    for (const league of activeLeagues) {
        console.log(`📡 Syncing league data: ${league.name}`);
        await syncLeague(league.league_id);
    }

    console.log(`✅ COMPREHENSIVE SYNC COMPLETE: ${activeLeagues.length} leagues processed`);
}

// ========================
// SYNC ALL MATCHUPS FOR CURRENT WEEK
// ========================

export async function syncAllMatchupsCurrentWeek(): Promise<void> {
    const state = queryOne<{ week: number }>('SELECT week FROM nfl_state WHERE id = 1');
    const currentWeek = state?.week || 1;

    const leagues = query<{ league_id: string }>(
        'SELECT league_id FROM leagues WHERE is_active = 1'
    );

    for (const league of leagues) {
        await syncMatchups(league.league_id, currentWeek);
    }
}

// ========================
// SYNC ALL TRANSACTIONS FOR CURRENT WEEK
// ========================

export async function syncAllTransactionsCurrentWeek(): Promise<void> {
    const state = queryOne<{ week: number }>('SELECT week FROM nfl_state WHERE id = 1');
    const currentWeek = state?.week || 1;

    const leagues = query<{ league_id: string }>(
        'SELECT league_id FROM leagues WHERE is_active = 1'
    );

    for (const league of leagues) {
        await syncTransactions(league.league_id, currentWeek);
    }
}

// ========================
// ADD LEAGUE BY ID
// ========================

export async function addLeague(leagueId: string, syncHistory: boolean = false): Promise<void> {
    console.log(`➕ Adding league ${leagueId} (history: ${syncHistory})...`);
    await syncNFLState();

    let currentId: string | null = leagueId;
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops

    while (currentId && depth < maxDepth) {
        const league = await syncLeague(currentId);

        // Sync current week (or last week if historical) matchups and transactions
        let weekToSync = 1;
        if (depth === 0) {
            const state = queryOne<{ week: number }>('SELECT week FROM nfl_state WHERE id = 1');
            weekToSync = state?.week || 1;
        } else {
            // For historical leagues, sync up to week 18 if it's a past season
            weekToSync = 18;
        }

        // Sync matchups for all weeks (simple approach for now)
        for (let w = 1; w <= (depth === 0 ? weekToSync : 18); w++) {
            try {
                await syncMatchups(currentId, w);
                await syncTransactions(currentId, w);
            } catch (err) {
                // Ignore errors for future weeks or missing data
            }
        }

        if (syncHistory && league.previous_league_id && league.previous_league_id !== '0') {
            currentId = league.previous_league_id;
            depth++;
            console.log(`   ⏭ Following history to previous league: ${currentId}`);
        } else {
            currentId = null;
        }
    }

    console.log(`✅ League ${leagueId} and its requested history added and synced!`);
}
