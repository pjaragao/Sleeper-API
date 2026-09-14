-- Sleeper Fantasy Assistant & Bot Knowledge Base Schema
-- Version: 2.0.0

-- ============================================
-- NFL GAMES TABLE (Scores, Schedule, Leaders)
-- ============================================
CREATE TABLE IF NOT EXISTS nfl_games (
    game_id TEXT PRIMARY KEY,
    season TEXT NOT NULL,
    season_type TEXT DEFAULT 'regular',
    week INTEGER NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    status TEXT NOT NULL, -- 'scheduled', 'in_progress', 'final'
    status_detail TEXT,   -- e.g. 'Final', 'Q4 01:23', 'Sun 1:00 PM'
    game_date TEXT,
    venue TEXT,
    leaders TEXT,         -- JSON: passing, rushing, receiving leaders
    odds TEXT,            -- JSON: spread, over/under
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nfl_games_season_week ON nfl_games(season, week);
CREATE INDEX IF NOT EXISTS idx_nfl_games_teams ON nfl_games(home_team, away_team);
CREATE INDEX IF NOT EXISTS idx_nfl_games_status ON nfl_games(status);

-- ============================================
-- NFL PLAYER STATS TABLE (Weekly Actuals)
-- ============================================
CREATE TABLE IF NOT EXISTS nfl_player_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    season TEXT NOT NULL,
    season_type TEXT DEFAULT 'regular',
    week INTEGER NOT NULL,
    pts_ppr REAL DEFAULT 0,
    pts_half_ppr REAL DEFAULT 0,
    pts_std REAL DEFAULT 0,
    stats TEXT, -- JSON with detailed stats
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(player_id, season, season_type, week)
);

CREATE INDEX IF NOT EXISTS idx_nfl_player_stats_pw ON nfl_player_stats(player_id, season, week);
CREATE INDEX IF NOT EXISTS idx_nfl_player_stats_pts ON nfl_player_stats(season, week, pts_ppr DESC);

-- ============================================
-- NFL PLAYER PROJECTIONS TABLE (Weekly Projections)
-- ============================================
CREATE TABLE IF NOT EXISTS nfl_player_projections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    season TEXT NOT NULL,
    season_type TEXT DEFAULT 'regular',
    week INTEGER NOT NULL,
    proj_pts_ppr REAL DEFAULT 0,
    proj_pts_half_ppr REAL DEFAULT 0,
    proj_pts_std REAL DEFAULT 0,
    projections TEXT, -- JSON
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(player_id, season, season_type, week)
);

CREATE INDEX IF NOT EXISTS idx_nfl_player_proj_pw ON nfl_player_projections(player_id, season, week);

-- ============================================
-- FANTASY NEWS & INJURIES TABLE (RSS/Scraper)
-- ============================================
CREATE TABLE IF NOT EXISTS fantasy_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id TEXT UNIQUE,
    source TEXT NOT NULL, -- 'fantasypros', 'rotowire', 'yahoo', 'pft', 'reddit'
    title TEXT NOT NULL,
    summary TEXT,
    link TEXT,
    category TEXT DEFAULT 'general', -- 'injury', 'waiver', 'trade', 'analysis', 'general'
    player_ids TEXT, -- JSON array of matched player_ids
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fantasy_news_source ON fantasy_news(source);
CREATE INDEX IF NOT EXISTS idx_fantasy_news_published ON fantasy_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_fantasy_news_category ON fantasy_news(category);

-- ============================================
-- ANALYTICAL VIEWS FOR THE BOT / AGENT
-- ============================================

-- Matchup pairs with scores and winner/loser
CREATE VIEW IF NOT EXISTS v_h2h_matchups AS
SELECT 
    m1.league_id,
    l.name as league_name,
    l.season,
    m1.week,
    m1.matchup_id,
    m1.roster_id as roster_a,
    u1.display_name as manager_a,
    m1.points as points_a,
    m2.roster_id as roster_b,
    u2.display_name as manager_b,
    m2.points as points_b,
    CASE 
        WHEN m1.points > m2.points THEN m1.roster_id
        WHEN m2.points > m1.points THEN m2.roster_id
        ELSE NULL
    END as winner_roster_id,
    ROUND(ABS(m1.points - m2.points), 2) as margin
FROM matchups m1
JOIN matchups m2 ON m1.league_id = m2.league_id 
    AND m1.week = m2.week 
    AND m1.matchup_id = m2.matchup_id 
    AND m1.roster_id < m2.roster_id
JOIN leagues l ON m1.league_id = l.league_id
LEFT JOIN rosters r1 ON m1.league_id = r1.league_id AND m1.roster_id = r1.roster_id
LEFT JOIN sleeper_users u1 ON r1.owner_id = u1.user_id
LEFT JOIN rosters r2 ON m2.league_id = r2.league_id AND m2.roster_id = r2.roster_id
LEFT JOIN sleeper_users u2 ON r2.owner_id = u2.user_id;

-- All-time high scores across all leagues/seasons
CREATE VIEW IF NOT EXISTS v_alltime_high_scores AS
SELECT 
    l.name as league_name,
    l.season,
    m.week,
    COALESCE(u.display_name, 'Unknown') as manager_name,
    m.points,
    m.roster_id,
    m.league_id
FROM matchups m
JOIN leagues l ON m.league_id = l.league_id
JOIN rosters r ON m.league_id = r.league_id AND m.roster_id = r.roster_id
LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
WHERE m.points > 0
ORDER BY m.points DESC;

-- All-time lowest scores across all leagues/seasons
CREATE VIEW IF NOT EXISTS v_alltime_low_scores AS
SELECT 
    l.name as league_name,
    l.season,
    m.week,
    COALESCE(u.display_name, 'Unknown') as manager_name,
    m.points,
    m.roster_id,
    m.league_id
FROM matchups m
JOIN leagues l ON m.league_id = l.league_id
JOIN rosters r ON m.league_id = r.league_id AND m.roster_id = r.roster_id
LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
WHERE m.points > 0
ORDER BY m.points ASC;
