-- Sleeper Fantasy Assistant & Bot Schedule Schema
-- Version: 3.0.0

-- ============================================
-- BOT MESSAGE LOG TABLE (Prevents duplicate sends & stores history)
-- ============================================
CREATE TABLE IF NOT EXISTS bot_message_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id TEXT NOT NULL,
    slot_key TEXT NOT NULL,          -- e.g. 'tue_08h_recap', 'fri_10h_h2h', 'game_final_401671790'
    season TEXT NOT NULL,
    week INTEGER NOT NULL,
    message_type TEXT NOT NULL,      -- 'scheduled', 'smart_trigger', 'instant_alert'
    message_text TEXT NOT NULL,
    metadata TEXT,                   -- JSON with trigger context
    sent_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'sent',      -- 'sent', 'preview', 'failed'
    UNIQUE(league_id, slot_key, season, week),
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bot_log_lookup ON bot_message_log(league_id, slot_key, season, week);
CREATE INDEX IF NOT EXISTS idx_bot_log_sent ON bot_message_log(sent_at DESC);

-- ============================================
-- LIVE GAME TRACKING CACHE
-- ============================================
CREATE TABLE IF NOT EXISTS live_game_tracker (
    game_id TEXT PRIMARY KEY,
    season TEXT NOT NULL,
    week INTEGER NOT NULL,
    last_status TEXT NOT NULL,
    has_final_triggered INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
);
