-- Sleeper Fantasy Assistant - SQLite Schema
-- Version: 1.0.0

-- ============================================
-- PLAYERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) STORED,
    position TEXT,
    team TEXT,
    age INTEGER,
    years_exp INTEGER,
    college TEXT,
    weight TEXT,
    height TEXT,
    jersey_number INTEGER,
    depth_chart_position INTEGER,
    depth_chart_order INTEGER,
    status TEXT,
    injury_status TEXT,
    injury_start_date TEXT,
    practice_participation TEXT,
    fantasy_positions TEXT, -- JSON array
    search_rank INTEGER,
    search_first_name TEXT,
    search_last_name TEXT,
    search_full_name TEXT,
    hashtag TEXT,
    sport TEXT DEFAULT 'nfl',
    birth_country TEXT,
    espn_id TEXT,
    yahoo_id TEXT,
    rotowire_id TEXT,
    rotoworld_id TEXT,
    stats_id TEXT,
    sportradar_id TEXT,
    fantasy_data_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_players_team ON players(team);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);

-- ============================================
-- SLEEPER USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sleeper_users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    avatar TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sleeper_users_username ON sleeper_users(username);

-- ============================================
-- LEAGUES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leagues (
    league_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    season TEXT NOT NULL,
    season_type TEXT,
    status TEXT,
    sport TEXT DEFAULT 'nfl',
    total_rosters INTEGER,
    avatar TEXT,
    scoring_settings TEXT, -- JSON
    roster_positions TEXT, -- JSON
    settings TEXT, -- JSON
    draft_id TEXT,
    previous_league_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leagues_season ON leagues(season);
CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status);
CREATE INDEX IF NOT EXISTS idx_leagues_active ON leagues(is_active);

-- ============================================
-- LEAGUE USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS league_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT,
    avatar TEXT,
    is_owner INTEGER DEFAULT 0,
    is_co_owner INTEGER DEFAULT 0,
    metadata TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(league_id, user_id),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES sleeper_users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_league_users_user ON league_users(user_id);

-- ============================================
-- ROSTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rosters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id TEXT NOT NULL,
    roster_id INTEGER NOT NULL,
    owner_id TEXT,
    co_owners TEXT, -- JSON
    players TEXT, -- JSON
    starters TEXT, -- JSON
    reserve TEXT, -- JSON
    taxi TEXT, -- JSON
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    ties INTEGER DEFAULT 0,
    fpts REAL DEFAULT 0,
    fpts_decimal REAL DEFAULT 0,
    fpts_against REAL DEFAULT 0,
    fpts_against_decimal REAL DEFAULT 0,
    waiver_position INTEGER,
    waiver_budget_used INTEGER DEFAULT 0,
    total_moves INTEGER DEFAULT 0,
    settings TEXT, -- JSON
    metadata TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(league_id, roster_id),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rosters_owner ON rosters(owner_id);

-- ============================================
-- MATCHUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS matchups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id TEXT NOT NULL,
    week INTEGER NOT NULL,
    matchup_id INTEGER NOT NULL,
    roster_id INTEGER NOT NULL,
    starters TEXT, -- JSON
    players TEXT, -- JSON
    points REAL,
    custom_points REAL,
    starters_points TEXT, -- JSON
    players_points TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(league_id, week, roster_id),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matchups_week ON matchups(league_id, week);
CREATE INDEX IF NOT EXISTS idx_matchups_matchup ON matchups(matchup_id);

-- ============================================
-- PLAYOFF BRACKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS playoff_brackets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id TEXT NOT NULL,
    bracket_type TEXT NOT NULL CHECK(bracket_type IN ('winners', 'losers')),
    round INTEGER NOT NULL,
    match_id INTEGER NOT NULL,
    team1_roster_id INTEGER,
    team2_roster_id INTEGER,
    team1_from TEXT, -- JSON
    team2_from TEXT, -- JSON
    winner_roster_id INTEGER,
    loser_roster_id INTEGER,
    placement INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(league_id, bracket_type, round, match_id),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_brackets_round ON playoff_brackets(league_id, bracket_type, round);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY,
    league_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('trade', 'waiver', 'free_agent', 'commissioner')),
    status TEXT,
    week INTEGER,
    roster_ids TEXT, -- JSON
    consenter_ids TEXT, -- JSON
    creator_id TEXT,
    adds TEXT, -- JSON
    drops TEXT, -- JSON
    draft_picks TEXT, -- JSON
    waiver_budget TEXT, -- JSON
    settings TEXT, -- JSON
    metadata TEXT, -- JSON
    created_at INTEGER, -- Unix timestamp
    status_updated INTEGER,
    fetched_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_week ON transactions(league_id, week);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

-- ============================================
-- TRADED PICKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS traded_picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id TEXT NOT NULL,
    season TEXT NOT NULL,
    round INTEGER NOT NULL,
    original_owner_id INTEGER NOT NULL,
    previous_owner_id INTEGER NOT NULL,
    current_owner_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(league_id, season, round, original_owner_id),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_traded_picks_season ON traded_picks(league_id, season);
CREATE INDEX IF NOT EXISTS idx_traded_picks_owner ON traded_picks(current_owner_id);

-- ============================================
-- DRAFTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS drafts (
    draft_id TEXT PRIMARY KEY,
    league_id TEXT,
    type TEXT,
    status TEXT,
    sport TEXT DEFAULT 'nfl',
    season TEXT,
    season_type TEXT,
    settings TEXT, -- JSON
    draft_order TEXT, -- JSON
    slot_to_roster_id TEXT, -- JSON
    metadata TEXT, -- JSON
    creators TEXT, -- JSON
    start_time INTEGER,
    last_picked INTEGER,
    last_message_time INTEGER,
    last_message_id TEXT,
    created INTEGER,
    fetched_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_drafts_league ON drafts(league_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);

-- ============================================
-- DRAFT PICKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS draft_picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    pick_no INTEGER NOT NULL,
    round INTEGER NOT NULL,
    draft_slot INTEGER,
    picked_by TEXT,
    roster_id INTEGER,
    is_keeper INTEGER DEFAULT 0,
    metadata TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(draft_id, pick_no),
    FOREIGN KEY (draft_id) REFERENCES drafts(draft_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_draft_picks_player ON draft_picks(player_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_round ON draft_picks(draft_id, round);

-- ============================================
-- TRENDING PLAYERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS trending_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    trend_type TEXT NOT NULL CHECK(trend_type IN ('add', 'drop')),
    count INTEGER NOT NULL,
    sport TEXT DEFAULT 'nfl',
    lookback_hours INTEGER DEFAULT 24,
    fetched_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trending_trend ON trending_players(trend_type, fetched_at);
CREATE INDEX IF NOT EXISTS idx_trending_player ON trending_players(player_id, trend_type);

-- ============================================
-- NFL STATE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS nfl_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    week INTEGER,
    season TEXT,
    season_type TEXT,
    season_start_date TEXT,
    display_week INTEGER,
    leg INTEGER,
    league_season TEXT,
    league_create_season TEXT,
    previous_season TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Initialize NFL state row
INSERT OR IGNORE INTO nfl_state (id) VALUES (1);

-- ============================================
-- SYNC LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL CHECK(sync_type IN (
        'players', 'leagues', 'rosters', 'matchups', 
        'transactions', 'trending', 'nfl_state',
        'playoff_brackets', 'traded_picks', 'drafts', 'draft_picks'
    )),
    league_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('started', 'completed', 'failed')),
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_type_status ON sync_logs(sync_type, status);
CREATE INDEX IF NOT EXISTS idx_sync_started ON sync_logs(started_at);

-- ============================================
-- APP SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT,
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
('players_sync_hour', '4', 'Hour of day (UTC) to sync players'),
('leagues_sync_hour', '5', 'Hour of day (UTC) to sync leagues and rosters'),
('api_rate_limit', '1000', 'Max API calls per minute to Sleeper');
