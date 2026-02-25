import { query, queryOne } from '../config/database.js';

// ========================
// TYPES
// ========================

export interface DraftAnalysis {
    draft_id: string;
    league_id: string;
    season: string;
    type: string;
    total_picks: number;
    teams: TeamDraftAnalysis[];
    position_breakdown: PositionBreakdown;
}

export interface TeamDraftAnalysis {
    roster_id: number;
    owner_name: string;
    owner_id: string;
    grade: string;
    grade_score: number;
    picks: DraftPickAnalysis[];
    position_counts: Record<string, number>;
    avg_adp_deviation: number;
    total_value: number;
    keepers: number;
}

export interface DraftPickAnalysis {
    pick_no: number;
    round: number;
    player_id: string;
    player_name: string;
    position: string;
    team: string;
    adp: number;
    adp_deviation: number; // Positive = reach, Negative = value
    value_score: number;
    is_keeper: boolean;
}

export interface PositionBreakdown {
    by_round: Record<number, Record<string, number>>;
    totals: Record<string, number>;
    by_team: Record<number, Record<string, number>>;
}

// ========================
// GRADE CALCULATION
// ========================

function calculateGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    if (score >= 45) return 'D+';
    if (score >= 40) return 'D';
    if (score >= 35) return 'D-';
    return 'F';
}

// ========================
// DRAFT ANALYTICS SERVICE
// ========================

export async function getDraftAnalysis(draftId: string): Promise<DraftAnalysis | null> {
    // Get draft info
    const draft = queryOne<{
        draft_id: string;
        league_id: string;
        season: string;
        type: string;
        settings: string;
    }>('SELECT draft_id, league_id, season, type, settings FROM drafts WHERE draft_id = ?', [draftId]);

    if (!draft) return null;

    // Get all picks with player info
    const picks = query<{
        pick_no: number;
        round: number;
        draft_slot: number;
        player_id: string;
        roster_id: number;
        picked_by: string;
        is_keeper: number;
        first_name: string;
        last_name: string;
        position: string;
        team: string;
        search_rank: number;
    }>(`
        SELECT dp.*, p.first_name, p.last_name, p.position, p.team, p.search_rank
        FROM draft_picks dp
        LEFT JOIN players p ON dp.player_id = p.player_id
        WHERE dp.draft_id = ?
        ORDER BY dp.pick_no
    `, [draftId]);

    // Get roster owners
    const rosters = query<{
        roster_id: number;
        owner_id: string;
        display_name: string;
    }>(`
        SELECT r.roster_id, r.owner_id, su.display_name
        FROM rosters r
        LEFT JOIN sleeper_users su ON r.owner_id = su.user_id
        WHERE r.league_id = ?
    `, [draft.league_id]);

    const rosterMap = new Map(rosters.map(r => [r.roster_id, r]));

    // Group picks by roster_id
    const picksByRoster = new Map<number, typeof picks>();
    for (const pick of picks) {
        if (!picksByRoster.has(pick.roster_id)) {
            picksByRoster.set(pick.roster_id, []);
        }
        picksByRoster.get(pick.roster_id)!.push(pick);
    }

    // Calculate analysis for each team
    const teams: TeamDraftAnalysis[] = [];
    const positionBreakdown: PositionBreakdown = {
        by_round: {},
        totals: {},
        by_team: {}
    };

    for (const [rosterId, rosterPicks] of picksByRoster) {
        const rosterInfo = rosterMap.get(rosterId);
        const positionCounts: Record<string, number> = {};
        const analyzedPicks: DraftPickAnalysis[] = [];
        let totalDeviation = 0;
        let totalValue = 0;
        let keeperCount = 0;

        for (const pick of rosterPicks) {
            const position = pick.position || 'Unknown';
            positionCounts[position] = (positionCounts[position] || 0) + 1;

            // Use search_rank as ADP proxy
            // Lower search_rank = better player
            const adp = pick.search_rank || pick.pick_no;
            const adpDeviation = pick.pick_no - adp; // Positive = reached, Negative = value

            // Value score: how much value relative to ADP
            // Getting a player later than their ADP is good
            const valueScore = Math.max(0, -adpDeviation * 2);
            totalDeviation += adpDeviation;
            totalValue += valueScore;

            if (pick.is_keeper) keeperCount++;

            analyzedPicks.push({
                pick_no: pick.pick_no,
                round: pick.round,
                player_id: pick.player_id,
                player_name: `${pick.first_name || ''} ${pick.last_name || ''}`.trim() || pick.player_id,
                position,
                team: pick.team || '',
                adp,
                adp_deviation: adpDeviation,
                value_score: valueScore,
                is_keeper: !!pick.is_keeper
            });

            // Update position breakdown by round
            if (!positionBreakdown.by_round[pick.round]) {
                positionBreakdown.by_round[pick.round] = {};
            }
            positionBreakdown.by_round[pick.round][position] =
                (positionBreakdown.by_round[pick.round][position] || 0) + 1;

            // Update totals
            positionBreakdown.totals[position] = (positionBreakdown.totals[position] || 0) + 1;
        }

        // Store position counts by team
        positionBreakdown.by_team[rosterId] = positionCounts;

        // Calculate grade based on average value and draft quality
        const avgDeviation = rosterPicks.length > 0 ? totalDeviation / rosterPicks.length : 0;

        // Store raw data for now - will normalize after all teams are processed
        teams.push({
            roster_id: rosterId,
            owner_name: rosterInfo?.display_name || `Team ${rosterId}`,
            owner_id: rosterInfo?.owner_id || '',
            grade: '', // Will be calculated after normalization
            grade_score: 0, // Will be calculated after normalization
            picks: analyzedPicks,
            position_counts: positionCounts,
            avg_adp_deviation: rosterPicks.length > 0 ? Math.round(avgDeviation * 10) / 10 : 0,
            total_value: Math.round(totalValue),
            keepers: keeperCount
        });
    }

    // Normalize grades relative to all teams in this draft
    // Calculate grades based on relative performance (avg_adp_deviation)
    if (teams.length > 0) {
        const deviations = teams.map(t => t.avg_adp_deviation);
        const minDev = Math.min(...deviations);
        const maxDev = Math.max(...deviations);
        const range = maxDev - minDev;

        for (const team of teams) {
            // Normalize: lower deviation is better (negative = got value)
            // Map to 0-100 scale where lowest deviation = 95, highest = 45
            let gradeScore: number;
            if (range === 0) {
                // All teams have same deviation
                gradeScore = 70;
            } else {
                // Lower deviation = higher score
                const normalized = (team.avg_adp_deviation - minDev) / range; // 0 to 1
                gradeScore = 95 - (normalized * 50); // 95 down to 45
            }
            team.grade_score = Math.round(gradeScore);
            team.grade = calculateGrade(gradeScore);
        }
    }

    // Sort teams by grade score
    teams.sort((a, b) => b.grade_score - a.grade_score);

    return {
        draft_id: draft.draft_id,
        league_id: draft.league_id,
        season: draft.season,
        type: draft.type,
        total_picks: picks.length,
        teams,
        position_breakdown: positionBreakdown
    };
}

// ========================
// GET DRAFT BOARD DATA
// ========================

export interface DraftBoardData {
    draft_id: string;
    type: string;
    settings: {
        teams: number;
        rounds: number;
        pick_timer: number;
    };
    teams: { roster_id: number; owner_name: string; draft_slot: number }[];
    picks: {
        pick_no: number;
        round: number;
        draft_slot: number;
        roster_id: number;
        player_id: string;
        player_name: string;
        position: string;
        team: string;
        is_keeper: boolean;
        picker_name?: string; // Who made the pick (may differ from slot owner for traded picks)
    }[];
}

export async function getDraftBoard(draftId: string): Promise<DraftBoardData | null> {
    const draft = queryOne<{
        draft_id: string;
        type: string;
        settings: string;
        slot_to_roster_id: string;
        draft_order: string;
        league_id: string;
    }>('SELECT draft_id, type, settings, slot_to_roster_id, draft_order, league_id FROM drafts WHERE draft_id = ?', [draftId]);

    if (!draft) return null;

    const settings = JSON.parse(draft.settings || '{}');
    const draftOrder = JSON.parse(draft.draft_order || '{}'); // user_id -> slot position

    // Get picks with picked_by user info
    const picks = query<{
        pick_no: number;
        round: number;
        draft_slot: number;
        roster_id: number;
        picked_by: string;
        player_id: string;
        is_keeper: number;
        first_name: string;
        last_name: string;
        position: string;
        team: string;
    }>(`
        SELECT dp.*, p.first_name, p.last_name, p.position, p.team
        FROM draft_picks dp
        LEFT JOIN players p ON dp.player_id = p.player_id
        WHERE dp.draft_id = ?
        ORDER BY dp.pick_no
    `, [draftId]);

    if (picks.length === 0) {
        return {
            draft_id: draft.draft_id,
            type: draft.type,
            settings: { teams: settings.teams || 12, rounds: settings.rounds || 15, pick_timer: 0 },
            teams: [],
            picks: []
        };
    }

    // Get all users for name lookup
    const users = query<{ user_id: string; display_name: string }>(`
        SELECT user_id, display_name FROM sleeper_users
    `, []);
    const userNameMap = new Map(users.map(u => [u.user_id, u.display_name]));

    // Build slot -> owner_name mapping from draft_order
    // draft_order is { user_id: slot_position }
    // We need to invert it to get { slot_position: user_id }
    const slotToOwner = new Map<number, string>();
    for (const [userId, slot] of Object.entries(draftOrder)) {
        const slotNum = Number(slot);
        const ownerName = userNameMap.get(userId) || `Slot ${slotNum}`;
        slotToOwner.set(slotNum, ownerName);
    }

    // Determine number of teams from unique draft_slots
    const uniqueSlots = [...new Set(picks.map(p => p.draft_slot))].sort((a, b) => a - b);
    const numTeams = uniqueSlots.length;
    const maxRound = Math.max(...picks.map(p => p.round));

    // Build teams array using draft_order for original owners
    const teams = uniqueSlots.map(slot => ({
        draft_slot: slot,
        roster_id: slot,
        owner_name: slotToOwner.get(slot) || `Slot ${slot}`
    }));

    return {
        draft_id: draft.draft_id,
        type: draft.type,
        settings: {
            teams: settings.teams || numTeams,
            rounds: settings.rounds || maxRound,
            pick_timer: settings.pick_timer || 0
        },
        teams,
        picks: picks.map(p => {
            // Get the name of who actually made this pick
            const pickerName = userNameMap.get(p.picked_by) || `Team ${p.roster_id}`;
            return {
                pick_no: p.pick_no,
                round: p.round,
                draft_slot: p.draft_slot,
                roster_id: p.roster_id,
                player_id: p.player_id,
                player_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.player_id,
                position: p.position || 'Unknown',
                team: p.team || '',
                is_keeper: !!p.is_keeper,
                picker_name: pickerName // Add who made the pick
            };
        })
    };
}

// ========================
// MANAGER DRAFT TENDENCIES
// ========================

export interface ManagerTendencies {
    user_id: string;
    display_name: string;
    drafts_analyzed: number;
    favorite_positions: { position: string; count: number; percentage: number }[];
    avg_first_pick_position: string;
    avg_draft_grade: string;
    early_round_positions: Record<string, number>; // Rounds 1-3
    late_round_positions: Record<string, number>; // Rounds 10+
}

export async function getManagerTendencies(userId: string): Promise<ManagerTendencies | null> {
    const user = queryOne<{ display_name: string }>(
        'SELECT display_name FROM sleeper_users WHERE user_id = ?',
        [userId]
    );

    if (!user) return null;

    // Get all draft picks for this user across all drafts
    const picks = query<{
        pick_no: number;
        round: number;
        position: string;
        draft_id: string;
    }>(`
        SELECT dp.pick_no, dp.round, p.position, dp.draft_id
        FROM draft_picks dp
        JOIN players p ON dp.player_id = p.player_id
        WHERE dp.picked_by = ?
        ORDER BY dp.draft_id, dp.pick_no
    `, [userId]);

    if (picks.length === 0) {
        return {
            user_id: userId,
            display_name: user.display_name,
            drafts_analyzed: 0,
            favorite_positions: [],
            avg_first_pick_position: 'N/A',
            avg_draft_grade: 'N/A',
            early_round_positions: {},
            late_round_positions: {}
        };
    }

    // Count unique drafts
    const uniqueDrafts = new Set(picks.map(p => p.draft_id));

    // Position counts
    const positionCounts: Record<string, number> = {};
    const earlyRoundPositions: Record<string, number> = {};
    const lateRoundPositions: Record<string, number> = {};
    const firstPicks: string[] = [];

    let currentDraft = '';
    for (const pick of picks) {
        const pos = pick.position || 'Unknown';
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;

        if (pick.round <= 3) {
            earlyRoundPositions[pos] = (earlyRoundPositions[pos] || 0) + 1;
        } else if (pick.round >= 10) {
            lateRoundPositions[pos] = (lateRoundPositions[pos] || 0) + 1;
        }

        // Track first pick per draft
        if (pick.draft_id !== currentDraft) {
            firstPicks.push(pos);
            currentDraft = pick.draft_id;
        }
    }

    // Calculate favorite positions
    const favoritePositions = Object.entries(positionCounts)
        .map(([position, count]) => ({
            position,
            count,
            percentage: Math.round((count / picks.length) * 100)
        }))
        .sort((a, b) => b.count - a.count);

    // Most common first pick position
    const firstPickCounts: Record<string, number> = {};
    firstPicks.forEach(pos => {
        firstPickCounts[pos] = (firstPickCounts[pos] || 0) + 1;
    });
    const avgFirstPickPosition = Object.entries(firstPickCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
        user_id: userId,
        display_name: user.display_name,
        drafts_analyzed: uniqueDrafts.size,
        favorite_positions: favoritePositions,
        avg_first_pick_position: avgFirstPickPosition,
        avg_draft_grade: 'B', // Would need to calculate across all drafts
        early_round_positions: earlyRoundPositions,
        late_round_positions: lateRoundPositions
    };
}
