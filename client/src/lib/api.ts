export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
    }

    return res.json();
}

// Types
export interface Player {
    player_id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    position: string;
    team: string;
    age: number;
    status: string;
    injury_status: string | null;
}

export interface League {
    league_id: string;
    name: string;
    season: string;
    status: string;
    total_rosters: number;
    avatar: string;
    season_count?: number;
    start_year?: string;
    end_year?: string;
}

export interface Roster {
    id: number;
    league_id: string;
    roster_id: number;
    owner_id: string;
    owner_name: string;
    players: string; // JSON string
    starters: string; // JSON string
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
}

export interface NFLState {
    week: number;
    season: string;
    season_type: string;
}

export interface Status {
    nflState: NFLState;
    leagues: number;
    players: number;
}

// API Functions
export async function getStatus(): Promise<Status> {
    return fetchApi('/status');
}

export async function getLeagues(params?: { ownerName?: string; grouped?: boolean }): Promise<{ data: League[] }> {
    const searchParams = new URLSearchParams();
    if (params?.ownerName) searchParams.set('ownerName', params.ownerName);
    if (params?.grouped) searchParams.set('grouped', 'true');
    const query = searchParams.toString();
    return fetchApi(`/leagues${query ? `?${query}` : ''}`);
}

export async function getLeague(leagueId: string): Promise<League> {
    return fetchApi(`/leagues/${leagueId}`);
}

export async function addLeague(leagueId: string): Promise<{ message: string; data: League }> {
    return fetchApi('/leagues', {
        method: 'POST',
        body: JSON.stringify({ leagueId }),
    });
}

export async function deleteLeague(leagueId: string): Promise<void> {
    return fetchApi(`/leagues/${leagueId}`, {
        method: 'DELETE',
    });
}

export async function getRosters(leagueId: string): Promise<{ data: Roster[] }> {
    return fetchApi(`/leagues/${leagueId}/rosters`);
}

export async function getPlayers(params?: {
    search?: string;
    position?: string;
    team?: string;
    limit?: number;
    sortBy?: 'rank' | 'position';
}): Promise<{ data: Player[]; count: number }> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.position) searchParams.set('position', params.position);
    if (params?.team) searchParams.set('team', params.team);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);

    const query = searchParams.toString();
    return fetchApi(`/players${query ? `?${query}` : ''}`);
}

export async function getPlayer(playerId: string): Promise<Player> {
    return fetchApi(`/players/${playerId}`);
}

export async function syncPlayers(): Promise<{ message: string; count: number }> {
    return fetchApi('/sync/players', { method: 'POST' });
}

export async function syncLeague(leagueId: string): Promise<{ message: string }> {
    return fetchApi(`/sync/league/${leagueId}`, { method: 'POST' });
}

// Enhanced player type with more info (includes draft picks)
export interface RosterPlayer extends Player {
    is_starter: boolean;
    search_rank: number;
    years_exp: number;
    college: string;
    jersey_number?: number;
    depth_chart_order?: number;
    is_pick?: boolean;
    pick_season?: string;
    pick_round?: number;
    original_owner_name?: string;
}

// Get roster players with full info, sorted by position then ranking
export async function getRosterPlayers(
    leagueId: string,
    rosterId: number
): Promise<{ data: RosterPlayer[]; starters: string[] }> {
    return fetchApi(`/leagues/${leagueId}/rosters/${rosterId}/players`);
}
