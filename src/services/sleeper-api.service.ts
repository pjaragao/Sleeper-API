import axios, { AxiosInstance } from 'axios';

// Sleeper API Types
export interface SleeperUser {
    user_id: string;
    username: string;
    display_name: string;
    avatar: string;
}

export interface SleeperLeague {
    league_id: string;
    name: string;
    season: string;
    season_type: string;
    status: string;
    sport: string;
    total_rosters: number;
    avatar: string;
    scoring_settings: Record<string, number>;
    roster_positions: string[];
    settings: Record<string, unknown>;
    draft_id: string;
    previous_league_id: string;
}

export interface SleeperRoster {
    roster_id: number;
    owner_id: string;
    league_id: string;
    players: string[];
    starters: string[];
    reserve: string[];
    taxi?: string[];
    co_owners?: string[];
    settings: {
        wins: number;
        losses: number;
        ties: number;
        fpts: number;
        fpts_decimal: number;
        fpts_against: number;
        fpts_against_decimal: number;
        waiver_position: number;
        waiver_budget_used: number;
        total_moves: number;
    };
    metadata?: Record<string, unknown>;
}

export interface SleeperMatchup {
    roster_id: number;
    matchup_id: number;
    starters: string[];
    players: string[];
    points: number;
    custom_points?: number;
    starters_points?: number[];
    players_points?: Record<string, number>;
}

export interface SleeperTransaction {
    transaction_id: string;
    type: 'trade' | 'waiver' | 'free_agent' | 'commissioner';
    status: string;
    roster_ids: number[];
    adds: Record<string, number> | null;
    drops: Record<string, number> | null;
    draft_picks: Array<{
        season: string;
        round: number;
        roster_id: number;
        previous_owner_id: number;
        owner_id: number;
    }>;
    waiver_budget: Array<{
        sender: number;
        receiver: number;
        amount: number;
    }>;
    settings?: { waiver_bid?: number };
    metadata?: Record<string, unknown>;
    leg: number;
    consenter_ids: number[];
    creator: string;
    created: number;
    status_updated: number;
}

export interface SleeperPlayer {
    player_id: string;
    first_name: string;
    last_name: string;
    position: string;
    team: string;
    age: number;
    years_exp: number;
    college: string;
    weight: string;
    height: string;
    number: number;
    depth_chart_position: number;
    depth_chart_order: number;
    status: string;
    injury_status: string;
    injury_start_date: string;
    practice_participation: string;
    fantasy_positions: string[];
    search_rank: number;
    search_first_name: string;
    search_last_name: string;
    search_full_name: string;
    hashtag: string;
    sport: string;
    birth_country: string;
    espn_id: string;
    yahoo_id: string;
    rotowire_id: string;
    rotoworld_id: string;
    stats_id: string;
    sportradar_id: string;
    fantasy_data_id: number;
}

export interface SleeperDraft {
    draft_id: string;
    league_id: string;
    type: string;
    status: string;
    sport: string;
    season: string;
    season_type: string;
    settings: Record<string, unknown>;
    draft_order: Record<string, number>;
    slot_to_roster_id: Record<string, number>;
    metadata: Record<string, unknown>;
    creators: string[] | null;
    start_time: number;
    last_picked: number;
    last_message_time: number;
    last_message_id: string;
    created: number;
}

export interface SleeperDraftPick {
    player_id: string;
    picked_by: string;
    roster_id: number;
    round: number;
    draft_slot: number;
    pick_no: number;
    metadata: Record<string, unknown>;
    is_keeper: boolean | null;
    draft_id: string;
}

export interface SleeperPlayoffBracket {
    r: number;       // round
    m: number;       // match_id
    t1?: number;     // team 1 roster_id
    t2?: number;     // team 2 roster_id
    t1_from?: { w?: number; l?: number };
    t2_from?: { w?: number; l?: number };
    w?: number;      // winner roster_id
    l?: number;      // loser roster_id
    p?: number;      // placement
}

export interface SleeperTradedPick {
    season: string;
    round: number;
    roster_id: number;
    previous_owner_id: number;
    owner_id: number;
}

export interface SleeperNFLState {
    week: number;
    season: string;
    season_type: string;
    season_start_date: string;
    display_week: number;
    leg: number;
    league_season: string;
    league_create_season: string;
    previous_season: string;
}

export interface TrendingPlayer {
    player_id: string;
    count: number;
}

class SleeperApiService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: process.env.SLEEPER_API_BASE_URL || 'https://api.sleeper.app/v1',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    // ========================
    // USER ENDPOINTS
    // ========================

    async getUser(usernameOrId: string): Promise<SleeperUser> {
        const response = await this.client.get(`/user/${usernameOrId}`);
        return response.data;
    }

    async getUserLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
        const response = await this.client.get(`/user/${userId}/leagues/nfl/${season}`);
        return response.data;
    }

    // ========================
    // LEAGUE ENDPOINTS
    // ========================

    async getLeague(leagueId: string): Promise<SleeperLeague> {
        const response = await this.client.get(`/league/${leagueId}`);
        return response.data;
    }

    async getRosters(leagueId: string): Promise<SleeperRoster[]> {
        const response = await this.client.get(`/league/${leagueId}/rosters`);
        return response.data;
    }

    async getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
        const response = await this.client.get(`/league/${leagueId}/users`);
        return response.data;
    }

    async getMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
        const response = await this.client.get(`/league/${leagueId}/matchups/${week}`);
        return response.data;
    }

    async getWinnersBracket(leagueId: string): Promise<SleeperPlayoffBracket[]> {
        const response = await this.client.get(`/league/${leagueId}/winners_bracket`);
        return response.data;
    }

    async getLosersBracket(leagueId: string): Promise<SleeperPlayoffBracket[]> {
        const response = await this.client.get(`/league/${leagueId}/losers_bracket`);
        return response.data;
    }

    async getTransactions(leagueId: string, week: number): Promise<SleeperTransaction[]> {
        const response = await this.client.get(`/league/${leagueId}/transactions/${week}`);
        return response.data;
    }

    async getTradedPicks(leagueId: string): Promise<SleeperTradedPick[]> {
        const response = await this.client.get(`/league/${leagueId}/traded_picks`);
        return response.data;
    }

    // ========================
    // DRAFT ENDPOINTS
    // ========================

    async getUserDrafts(userId: string, sport: string = 'nfl', season: string): Promise<SleeperDraft[]> {
        const response = await this.client.get(`/user/${userId}/drafts/${sport}/${season}`);
        return response.data;
    }

    async getDraftsForLeague(leagueId: string): Promise<SleeperDraft[]> {
        const response = await this.client.get(`/league/${leagueId}/drafts`);
        return response.data;
    }

    async getDraft(draftId: string): Promise<SleeperDraft> {
        const response = await this.client.get(`/draft/${draftId}`);
        return response.data;
    }

    async getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
        const response = await this.client.get(`/draft/${draftId}/picks`);
        return response.data;
    }

    async getTradedDraftPicks(draftId: string): Promise<SleeperTradedPick[]> {
        const response = await this.client.get(`/draft/${draftId}/traded_picks`);
        return response.data;
    }

    // ========================
    // PLAYERS ENDPOINTS
    // ========================

    async getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
        const response = await this.client.get('/players/nfl');
        return response.data;
    }

    async getTrendingPlayers(
        type: 'add' | 'drop',
        lookbackHours: number = 24,
        limit: number = 25
    ): Promise<TrendingPlayer[]> {
        const response = await this.client.get(
            `/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`
        );
        return response.data;
    }

    // ========================
    // NFL STATE
    // ========================

    async getNFLState(): Promise<SleeperNFLState> {
        const response = await this.client.get('/state/nfl');
        return response.data;
    }
}

// Export singleton instance
export const sleeperApi = new SleeperApiService();
