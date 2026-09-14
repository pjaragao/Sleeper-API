import { query, queryOne, execute } from '../config/database.js';
import { nflCollector } from './nfl-collector.service.js';
import { weeklySchedule } from './weekly-schedule.service.js';

export interface GameWatcherCheckResult {
    gamesChecked: number;
    newFinalsDetected: number;
    messagesTriggered: number;
}

export class GameWatcherService {
    /**
     * Checks for live game status changes and triggers flash messages upon game completion
     */
    async checkLiveGames(season?: string, week?: number): Promise<GameWatcherCheckResult> {
        const nflState = queryOne('SELECT * FROM nfl_state WHERE id = 1') as any;
        const currentSeason = season || nflState?.season || String(new Date().getFullYear());
        const currentWeek = week || nflState?.week || 1;

        // Sync fresh scoreboard from ESPN
        const games = await nflCollector.syncScoreboard(currentWeek, currentSeason);
        let newFinals = 0;
        let messagesSent = 0;

        // Active leagues
        const activeLeagues = query('SELECT league_id, name FROM leagues WHERE is_active = 1') as any[];

        for (const g of games) {
            const tracker = queryOne(
                'SELECT * FROM live_game_tracker WHERE game_id = ?',
                [g.game_id]
            ) as any;

            const isFinal = g.status === 'final';

            if (!tracker) {
                execute(
                    `INSERT INTO live_game_tracker (game_id, season, week, last_status, has_final_triggered, updated_at)
                     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                    [g.game_id, g.season, g.week, g.status, isFinal ? 1 : 0]
                );
                continue;
            }

            // Check if game just ended
            if (isFinal && tracker.has_final_triggered === 0) {
                newFinals++;
                console.log(`⚡ Game ended: ${g.away_team} @ ${g.home_team}! Triggering game final flash...`);

                // For each active league, generate and log flash message
                for (const league of activeLeagues) {
                    const slotKey = `game_final_${g.game_id}`;

                    // Check if already logged for this league
                    const alreadySent = queryOne(
                        'SELECT id FROM bot_message_log WHERE league_id = ? AND slot_key = ?',
                        [league.league_id, slotKey]
                    );

                    if (!alreadySent) {
                        const flash = weeklySchedule.generateGameFinalFlash(league.league_id, g, g.week);

                        execute(
                            `INSERT OR REPLACE INTO bot_message_log (
                                league_id, slot_key, season, week, message_type, message_text, metadata, sent_at, status
                            ) VALUES (?, ?, ?, ?, 'smart_trigger', ?, ?, datetime('now'), 'sent')`,
                            [
                                league.league_id,
                                slotKey,
                                g.season,
                                g.week,
                                flash.message_text,
                                JSON.stringify({ game_id: g.game_id, home: g.home_team, away: g.away_team, score: `${g.away_score}-${g.home_score}` })
                            ]
                        );
                        messagesSent++;
                    }
                }

                // Mark game as triggered
                execute(
                    "UPDATE live_game_tracker SET has_final_triggered = 1, last_status = 'final', updated_at = datetime('now') WHERE game_id = ?",
                    [g.game_id]
                );
            }
        }

        return {
            gamesChecked: games.length,
            newFinalsDetected: newFinals,
            messagesTriggered: messagesSent
        };
    }
}

export const gameWatcher = new GameWatcherService();
