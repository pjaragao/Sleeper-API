import { query, queryOne } from '../config/database.js';

export interface LeagueFamily {
    name: string;
    slug: string;
    seasons: Array<{
        season: string;
        league_id: string;
        status: string;
        total_rosters: number;
    }>;
}

export interface ManagerCareerStats {
    user_id: string;
    display_name: string;
    avatar?: string;
    seasons_played: number;
    total_wins: number;
    total_losses: number;
    total_ties: number;
    win_pct: number;
    total_fpts: number;
    avg_fpts_per_season: number;
    total_moves: number;
    championships: number;
    runner_ups: number;
}

export interface H2HRecord {
    manager_a: string;
    manager_b: string;
    games_played: number;
    wins_a: number;
    wins_b: number;
    ties: number;
    total_points_a: number;
    total_points_b: number;
    closest_match?: {
        season: string;
        week: number;
        score_a: number;
        score_b: number;
        margin: number;
        winner: string;
    };
    biggest_blowout?: {
        season: string;
        week: number;
        score_a: number;
        score_b: number;
        margin: number;
        winner: string;
    };
}

export class LeagueAnalyticsService {
    /**
     * Get all unique league families grouped by name
     */
    getLeagueFamilies(): LeagueFamily[] {
        const rows = query(`
            SELECT league_id, name, season, status, total_rosters, previous_league_id
            FROM leagues
            ORDER BY name ASC, CAST(season AS INTEGER) DESC
        `) as any[];

        const map = new Map<string, LeagueFamily>();

        for (const r of rows) {
            const cleanName = r.name.trim();
            const slug = cleanName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

            if (!map.has(slug)) {
                map.set(slug, {
                    name: cleanName,
                    slug,
                    seasons: []
                });
            }

            map.get(slug)!.seasons.push({
                season: r.season,
                league_id: r.league_id,
                status: r.status,
                total_rosters: r.total_rosters
            });
        }

        return Array.from(map.values());
    }

    /**
     * Get all league IDs belonging to a family
     */
    getLeagueIdsForFamily(family: LeagueFamily): string[] {
        return family.seasons.map(s => s.league_id);
    }

    /**
     * Calculate all-time manager career stats across all seasons of a league family
     */
    getManagerCareerStats(family: LeagueFamily): ManagerCareerStats[] {
        const leagueIds = this.getLeagueIdsForFamily(family);
        if (leagueIds.length === 0) return [];

        const placeholders = leagueIds.map(() => '?').join(',');

        const rows = query(`
            SELECT 
                COALESCE(u.user_id, r.owner_id) as user_id,
                COALESCE(u.display_name, lu.display_name, 'Manager ' || r.roster_id) as display_name,
                u.avatar,
                COUNT(DISTINCT r.league_id) as seasons_played,
                SUM(COALESCE(r.wins, 0)) as total_wins,
                SUM(COALESCE(r.losses, 0)) as total_losses,
                SUM(COALESCE(r.ties, 0)) as total_ties,
                SUM(COALESCE(r.fpts, 0) + (COALESCE(r.fpts_decimal, 0) * 0.01)) as total_fpts,
                SUM(COALESCE(r.total_moves, 0)) as total_moves
            FROM rosters r
            JOIN leagues l ON r.league_id = l.league_id
            LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
            LEFT JOIN league_users lu ON r.league_id = lu.league_id AND r.owner_id = lu.user_id
            WHERE r.league_id IN (${placeholders}) AND r.owner_id IS NOT NULL
            GROUP BY COALESCE(u.user_id, r.owner_id)
            ORDER BY total_wins DESC, total_fpts DESC
        `, leagueIds) as any[];

        // Champions and runners-up from playoff brackets
        const championshipsMap = new Map<string, { champs: number; runnerUps: number }>();
        const bracketRows = query(`
            SELECT pb.league_id, pb.placement, pb.winner_roster_id, pb.loser_roster_id, r_win.owner_id as win_owner, r_lose.owner_id as lose_owner
            FROM playoff_brackets pb
            LEFT JOIN rosters r_win ON pb.league_id = r_win.league_id AND pb.winner_roster_id = r_win.roster_id
            LEFT JOIN rosters r_lose ON pb.league_id = r_lose.league_id AND pb.loser_roster_id = r_lose.roster_id
            WHERE pb.league_id IN (${placeholders}) AND pb.bracket_type = 'winners' AND pb.placement = 1
        `, leagueIds) as any[];

        for (const b of bracketRows) {
            if (b.win_owner) {
                const current = championshipsMap.get(b.win_owner) || { champs: 0, runnerUps: 0 };
                current.champs++;
                championshipsMap.set(b.win_owner, current);
            }
            if (b.lose_owner) {
                const current = championshipsMap.get(b.lose_owner) || { champs: 0, runnerUps: 0 };
                current.runnerUps++;
                championshipsMap.set(b.lose_owner, current);
            }
        }

        return rows.map(r => {
            const totalGames = r.total_wins + r.total_losses + r.total_ties;
            const winPct = totalGames > 0 ? (r.total_wins / totalGames) * 100 : 0;
            const awards = championshipsMap.get(r.user_id) || { champs: 0, runnerUps: 0 };

            return {
                user_id: r.user_id,
                display_name: r.display_name,
                avatar: r.avatar,
                seasons_played: r.seasons_played,
                total_wins: r.total_wins,
                total_losses: r.total_losses,
                total_ties: r.total_ties,
                win_pct: Math.round(winPct * 10) / 10,
                total_fpts: Math.round(r.total_fpts * 100) / 100,
                avg_fpts_per_season: r.seasons_played > 0 ? Math.round((r.total_fpts / r.seasons_played) * 10) / 10 : 0,
                total_moves: r.total_moves,
                championships: awards.champs,
                runner_ups: awards.runnerUps
            };
        });
    }

    /**
     * Calculate Head-to-Head (H2H) matrix between all managers in the league
     */
    getH2HMatrix(family: LeagueFamily): H2HRecord[] {
        const leagueIds = this.getLeagueIdsForFamily(family);
        if (leagueIds.length === 0) return [];

        const placeholders = leagueIds.map(() => '?').join(',');

        const matchups = query(`
            SELECT 
                l.season,
                m1.week,
                m1.matchup_id,
                COALESCE(u1.display_name, 'Time ' || m1.roster_id) as manager_a,
                m1.points as points_a,
                COALESCE(u2.display_name, 'Time ' || m2.roster_id) as manager_b,
                m2.points as points_b
            FROM matchups m1
            JOIN matchups m2 ON m1.league_id = m2.league_id 
                AND m1.week = m2.week 
                AND m1.matchup_id = m2.matchup_id 
                AND m1.roster_id < m2.roster_id
            JOIN leagues l ON m1.league_id = l.league_id
            JOIN rosters r1 ON m1.league_id = r1.league_id AND m1.roster_id = r1.roster_id
            LEFT JOIN sleeper_users u1 ON r1.owner_id = u1.user_id
            JOIN rosters r2 ON m2.league_id = r2.league_id AND m2.roster_id = r2.roster_id
            LEFT JOIN sleeper_users u2 ON r2.owner_id = u2.user_id
            WHERE m1.league_id IN (${placeholders}) 
                AND m1.points > 0 AND m2.points > 0
            ORDER BY CAST(l.season AS INTEGER) ASC, m1.week ASC
        `, leagueIds) as any[];

        const pairMap = new Map<string, H2HRecord>();

        for (const m of matchups) {
            // Sort manager names alphabetically for consistent key
            const isAsc = m.manager_a.localeCompare(m.manager_b) <= 0;
            const nameA = isAsc ? m.manager_a : m.manager_b;
            const nameB = isAsc ? m.manager_b : m.manager_a;
            const ptsA = isAsc ? m.points_a : m.points_b;
            const ptsB = isAsc ? m.points_b : m.points_a;
            const key = `${nameA} VS ${nameB}`;

            if (!pairMap.has(key)) {
                pairMap.set(key, {
                    manager_a: nameA,
                    manager_b: nameB,
                    games_played: 0,
                    wins_a: 0,
                    wins_b: 0,
                    ties: 0,
                    total_points_a: 0,
                    total_points_b: 0
                });
            }

            const record = pairMap.get(key)!;
            record.games_played++;
            record.total_points_a += ptsA;
            record.total_points_b += ptsB;

            const margin = Math.round(Math.abs(ptsA - ptsB) * 100) / 100;
            const winner = ptsA > ptsB ? nameA : ptsB > ptsA ? nameB : 'Empate';

            if (ptsA > ptsB) record.wins_a++;
            else if (ptsB > ptsA) record.wins_b++;
            else record.ties++;

            const matchDetail = {
                season: m.season,
                week: m.week,
                score_a: ptsA,
                score_b: ptsB,
                margin,
                winner
            };

            // Track closest match
            if (!record.closest_match || margin < record.closest_match.margin) {
                record.closest_match = matchDetail;
            }

            // Track biggest blowout
            if (!record.biggest_blowout || margin > record.biggest_blowout.margin) {
                record.biggest_blowout = matchDetail;
            }
        }

        return Array.from(pairMap.values())
            .filter(r => r.games_played > 0)
            .sort((a, b) => b.games_played - a.games_played);
    }

    /**
     * Get All-Time Records for a league family
     */
    getAllTimeRecords(family: LeagueFamily) {
        const leagueIds = this.getLeagueIdsForFamily(family);
        if (leagueIds.length === 0) return { highScores: [], lowScores: [], blowouts: [] };

        const placeholders = leagueIds.map(() => '?').join(',');

        const highScores = query(`
            SELECT 
                l.season,
                m.week,
                COALESCE(u.display_name, 'Time ' || m.roster_id) as manager,
                m.points
            FROM matchups m
            JOIN leagues l ON m.league_id = l.league_id
            JOIN rosters r ON m.league_id = r.league_id AND m.roster_id = r.roster_id
            LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
            WHERE m.league_id IN (${placeholders}) AND m.points > 0
            ORDER BY m.points DESC
            LIMIT 10
        `, leagueIds) as any[];

        const lowScores = query(`
            SELECT 
                l.season,
                m.week,
                COALESCE(u.display_name, 'Time ' || m.roster_id) as manager,
                m.points
            FROM matchups m
            JOIN leagues l ON m.league_id = l.league_id
            JOIN rosters r ON m.league_id = r.league_id AND m.roster_id = r.roster_id
            LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
            WHERE m.league_id IN (${placeholders}) AND m.points > 0
            ORDER BY m.points ASC
            LIMIT 10
        `, leagueIds) as any[];

        const blowouts = query(`
            SELECT 
                l.season,
                m1.week,
                COALESCE(u1.display_name, 'Time ' || m1.roster_id) as manager_a,
                m1.points as points_a,
                COALESCE(u2.display_name, 'Time ' || m2.roster_id) as manager_b,
                m2.points as points_b,
                ROUND(ABS(m1.points - m2.points), 2) as margin,
                CASE WHEN m1.points > m2.points THEN u1.display_name ELSE u2.display_name END as winner
            FROM matchups m1
            JOIN matchups m2 ON m1.league_id = m2.league_id 
                AND m1.week = m2.week 
                AND m1.matchup_id = m2.matchup_id 
                AND m1.roster_id < m2.roster_id
            JOIN leagues l ON m1.league_id = l.league_id
            JOIN rosters r1 ON m1.league_id = r1.league_id AND m1.roster_id = r1.roster_id
            LEFT JOIN sleeper_users u1 ON r1.owner_id = u1.user_id
            JOIN rosters r2 ON m2.league_id = r2.league_id AND m2.roster_id = r2.roster_id
            LEFT JOIN sleeper_users u2 ON r2.owner_id = u2.user_id
            WHERE m1.league_id IN (${placeholders}) AND m1.points > 0 AND m2.points > 0
            ORDER BY margin DESC
            LIMIT 10
        `, leagueIds) as any[];

        return { highScores, lowScores, blowouts };
    }

    /**
     * Get full trade history across all seasons with player names resolved
     */
    getTradeHistory(family: LeagueFamily): any[] {
        const leagueIds = this.getLeagueIdsForFamily(family);
        if (leagueIds.length === 0) return [];

        const placeholders = leagueIds.map(() => '?').join(',');

        const trades = query(`
            SELECT 
                t.transaction_id,
                t.league_id,
                l.name as league_name,
                l.season,
                t.week,
                t.status,
                t.roster_ids,
                t.adds,
                t.drops,
                t.draft_picks,
                t.waiver_budget,
                t.created_at
            FROM transactions t
            JOIN leagues l ON t.league_id = l.league_id
            WHERE t.league_id IN (${placeholders}) AND t.type = 'trade' AND t.status = 'complete'
            ORDER BY t.created_at DESC
        `, leagueIds) as any[];

        // Player name lookup helper
        const playerCache = new Map<string, string>();
        const getPlayerName = (id: string): string => {
            if (playerCache.has(id)) return playerCache.get(id)!;
            const p = queryOne('SELECT full_name, position, team FROM players WHERE player_id = ?', [id]) as any;
            const name = p ? `${p.full_name} (${p.position || 'FLEX'} - ${p.team || 'FA'})` : `Player ${id}`;
            playerCache.set(id, name);
            return name;
        };

        // Manager name lookup
        const managerCache = new Map<string, string>();
        const getManagerName = (leagueId: string, rosterId: number): string => {
            const key = `${leagueId}:${rosterId}`;
            if (managerCache.has(key)) return managerCache.get(key)!;
            const r = queryOne(`
                SELECT COALESCE(u.display_name, 'Time ' || r.roster_id) as display_name
                FROM rosters r
                LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
                WHERE r.league_id = ? AND r.roster_id = ?
            `, [leagueId, rosterId]) as any;
            const name = r?.display_name || `Time ${rosterId}`;
            managerCache.set(key, name);
            return name;
        };

        return trades.map(t => {
            const rosterIds: number[] = (t.roster_ids ? JSON.parse(t.roster_ids) : null) || [];
            const adds: Record<string, number> = (t.adds ? JSON.parse(t.adds) : null) || {};
            const draftPicks: any[] = (t.draft_picks ? JSON.parse(t.draft_picks) : null) || [];
            const waiverBudget: any[] = (t.waiver_budget ? JSON.parse(t.waiver_budget) : null) || [];

            // Breakdown per roster
            const sides = rosterIds.map(rid => {
                const manager = getManagerName(t.league_id, rid);
                // Players received by this roster
                const playersReceived = Object.entries(adds)
                    .filter(([_, destRosterId]) => destRosterId === rid)
                    .map(([pid]) => getPlayerName(pid));

                // Picks received by this roster
                const picksReceived = draftPicks
                    .filter(dp => dp.owner_id === rid)
                    .map(dp => `Pick Round ${dp.round} (${dp.season})`);

                // FAAB received
                const faabReceived = waiverBudget
                    .filter(wb => wb.receiver === rid)
                    .map(wb => `$${wb.amount} FAAB`);

                return {
                    roster_id: rid,
                    manager,
                    received: [...playersReceived, ...picksReceived, ...faabReceived]
                };
            });

            return {
                transaction_id: t.transaction_id,
                season: t.season,
                week: t.week,
                date: t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : 'Desconhecida',
                sides
            };
        });
    }

    /**
     * Get draft history with steals & reaches analysis
     */
    getDraftHistory(family: LeagueFamily): any[] {
        const leagueIds = this.getLeagueIdsForFamily(family);
        if (leagueIds.length === 0) return [];

        const placeholders = leagueIds.map(() => '?').join(',');

        const drafts = query(`
            SELECT 
                d.draft_id,
                d.league_id,
                l.name as league_name,
                d.season,
                d.type,
                d.status
            FROM drafts d
            JOIN leagues l ON d.league_id = l.league_id
            WHERE d.league_id IN (${placeholders})
            ORDER BY CAST(d.season AS INTEGER) DESC
        `, leagueIds) as any[];

        return drafts.map(d => {
            const picks = query(`
                SELECT 
                    dp.pick_no,
                    dp.round,
                    dp.draft_slot,
                    COALESCE(u.display_name, 'Slot ' || dp.draft_slot) as picked_by,
                    COALESCE(p.full_name, dp.player_id) as player_name,
                    p.position,
                    p.team
                FROM draft_picks dp
                LEFT JOIN sleeper_users u ON dp.picked_by = u.user_id
                LEFT JOIN players p ON dp.player_id = p.player_id
                WHERE dp.draft_id = ?
                ORDER BY dp.pick_no ASC
            `, [d.draft_id]) as any[];

            const round1 = picks.filter(p => p.round === 1);
            const totalPicks = picks.length;

            return {
                draft_id: d.draft_id,
                season: d.season,
                type: d.type,
                status: d.status,
                total_picks: totalPicks,
                round1_picks: round1,
                all_picks: picks
            };
        });
    }

    /**
     * Get weekly recap (matchups, waivers, highest score) for a specific season and week
     */
    getWeeklyRecap(leagueId: string, week: number) {
        const league = queryOne('SELECT * FROM leagues WHERE league_id = ?', [leagueId]) as any;
        if (!league) return null;

        // Matchups
        const matchups = query(`
            SELECT 
                m1.matchup_id,
                COALESCE(u1.display_name, 'Time ' || m1.roster_id) as manager_a,
                m1.points as points_a,
                COALESCE(u2.display_name, 'Time ' || m2.roster_id) as manager_b,
                m2.points as points_b,
                CASE WHEN m1.points > m2.points THEN u1.display_name ELSE u2.display_name END as winner,
                ROUND(ABS(m1.points - m2.points), 2) as margin
            FROM matchups m1
            JOIN matchups m2 ON m1.league_id = m2.league_id 
                AND m1.week = m2.week 
                AND m1.matchup_id = m2.matchup_id 
                AND m1.roster_id < m2.roster_id
            JOIN rosters r1 ON m1.league_id = r1.league_id AND m1.roster_id = r1.roster_id
            LEFT JOIN sleeper_users u1 ON r1.owner_id = u1.user_id
            JOIN rosters r2 ON m2.league_id = r2.league_id AND m2.roster_id = r2.roster_id
            LEFT JOIN sleeper_users u2 ON r2.owner_id = u2.user_id
            WHERE m1.league_id = ? AND m1.week = ? AND m1.points > 0
            ORDER BY margin ASC
        `, [leagueId, week]) as any[];

        // Top scorer of the week
        const topScorer = queryOne(`
            SELECT 
                COALESCE(u.display_name, 'Time ' || m.roster_id) as manager,
                m.points
            FROM matchups m
            JOIN rosters r ON m.league_id = r.league_id AND m.roster_id = r.roster_id
            LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
            WHERE m.league_id = ? AND m.week = ? AND m.points > 0
            ORDER BY m.points DESC
            LIMIT 1
        `, [leagueId, week]) as any;

        // Lowest scorer of the week
        const lowestScorer = queryOne(`
            SELECT 
                COALESCE(u.display_name, 'Time ' || m.roster_id) as manager,
                m.points
            FROM matchups m
            JOIN rosters r ON m.league_id = r.league_id AND m.roster_id = r.roster_id
            LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
            WHERE m.league_id = ? AND m.week = ? AND m.points > 0
            ORDER BY m.points ASC
            LIMIT 1
        `, [leagueId, week]) as any;

        // Waivers of the week
        const transactions = query(`
            SELECT 
                t.type,
                t.adds,
                t.drops,
                t.settings,
                COALESCE(u.display_name, 'Manager') as manager
            FROM transactions t
            LEFT JOIN sleeper_users u ON t.creator_id = u.user_id
            WHERE t.league_id = ? AND t.week = ? AND t.status = 'complete'
            ORDER BY t.created_at DESC
        `, [leagueId, week]) as any[];

        return {
            league_name: league.name,
            season: league.season,
            week,
            matchups,
            topScorer,
            lowestScorer,
            transactions_count: transactions.length,
            transactions
        };
    }
}

export const leagueAnalytics = new LeagueAnalyticsService();
