import { API_BASE } from './api';

// ========================
// TYPES
// ========================

export interface Draft {
    draft_id: string;
    league_id: string;
    league_name?: string;
    type: string;
    status: string;
    sport: string;
    season: string;
    season_type: string;
    settings: {
        teams?: number;
        rounds?: number;
        pick_timer?: number;
        slots_qb?: number;
        slots_rb?: number;
        slots_wr?: number;
        slots_te?: number;
        slots_flex?: number;
        slots_def?: number;
        slots_k?: number;
        slots_bn?: number;
    };
    draft_order: Record<string, number>;
    slot_to_roster_id: Record<string, number>;
    metadata: {
        scoring_type?: string;
        name?: string;
        description?: string;
    };
    start_time: number;
    created: number;
}

export interface DraftPick {
    pick_no: number;
    round: number;
    draft_slot: number;
    player_id: string;
    roster_id: number;
    picked_by: string;
    is_keeper: boolean;
    first_name: string;
    last_name: string;
    position: string;
    team: string;
    search_rank: number;
}

export interface TeamDraftAnalysis {
    roster_id: number;
    owner_name: string;
    owner_id: string;
    grade: string;
    grade_score: number;
    picks: {
        pick_no: number;
        round: number;
        player_id: string;
        player_name: string;
        position: string;
        team: string;
        adp: number;
        adp_deviation: number;
        value_score: number;
        is_keeper: boolean;
    }[];
    position_counts: Record<string, number>;
    avg_adp_deviation: number;
    total_value: number;
    keepers: number;
}

export interface DraftAnalysis {
    draft_id: string;
    league_id: string;
    season: string;
    type: string;
    total_picks: number;
    teams: TeamDraftAnalysis[];
    position_breakdown: {
        by_round: Record<number, Record<string, number>>;
        totals: Record<string, number>;
        by_team: Record<number, Record<string, number>>;
    };
}

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
        picker_name?: string;
    }[];
}

export interface ManagerTendencies {
    user_id: string;
    display_name: string;
    drafts_analyzed: number;
    favorite_positions: { position: string; count: number; percentage: number }[];
    avg_first_pick_position: string;
    avg_draft_grade: string;
    early_round_positions: Record<string, number>;
    late_round_positions: Record<string, number>;
}

// ========================
// API FUNCTIONS
// ========================

async function fetchApi<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

export async function getDrafts(params?: {
    leagueId?: string;
    leagueName?: string;
    season?: string;
    status?: string;
}): Promise<{ data: Draft[] }> {
    const searchParams = new URLSearchParams();
    if (params?.leagueId) searchParams.set('leagueId', params.leagueId);
    if (params?.leagueName) searchParams.set('leagueName', params.leagueName);
    if (params?.season) searchParams.set('season', params.season);
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return fetchApi(`/drafts${query ? `?${query}` : ''}`);
}

export async function getDraft(draftId: string): Promise<Draft> {
    return fetchApi(`/drafts/${draftId}`);
}

export async function getDraftPicks(draftId: string): Promise<{ data: DraftPick[] }> {
    return fetchApi(`/drafts/${draftId}/picks`);
}

export async function getDraftAnalysis(draftId: string): Promise<DraftAnalysis> {
    return fetchApi(`/drafts/${draftId}/analysis`);
}

export async function getDraftBoard(draftId: string): Promise<DraftBoardData> {
    return fetchApi(`/drafts/${draftId}/board`);
}

export async function getLeagueDrafts(leagueId: string): Promise<{ data: Draft[] }> {
    return fetchApi(`/leagues/${leagueId}/drafts`);
}

export async function getManagerTendencies(userId: string): Promise<ManagerTendencies> {
    return fetchApi(`/users/${userId}/tendencies`);
}

// ========================
// HELPERS
// ========================

export const POSITION_COLORS: Record<string, string> = {
    QB: '#ef4444',   // Red
    RB: '#22c55e',   // Green
    WR: '#3b82f6',   // Blue
    TE: '#f97316',   // Orange
    K: '#8b5cf6',    // Purple
    DEF: '#6b7280',  // Gray
    DL: '#14b8a6',   // Teal
    LB: '#eab308',   // Yellow
    DB: '#ec4899',   // Pink
};

export const GRADE_COLORS: Record<string, string> = {
    'A+': '#22c55e',
    'A': '#22c55e',
    'A-': '#4ade80',
    'B+': '#84cc16',
    'B': '#a3e635',
    'B-': '#bef264',
    'C+': '#facc15',
    'C': '#fbbf24',
    'C-': '#f59e0b',
    'D+': '#fb923c',
    'D': '#f97316',
    'D-': '#ea580c',
    'F': '#ef4444',
};

export function formatDraftDate(timestamp: number): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export function formatDraftType(type: string): string {
    const types: Record<string, string> = {
        snake: 'Snake',
        linear: 'Linear',
        auction: 'Auction'
    };
    return types[type] || type;
}
