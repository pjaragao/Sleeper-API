import cron from 'node-cron';
import { query, queryOne, execute } from '../config/database.js';
import { weeklySchedule } from './weekly-schedule.service.js';
import { gameWatcher } from './game-watcher.service.js';
import {
    syncPlayers,
    syncAllLeagues,
    syncTrending,
    syncNFLState,
    syncAllMatchupsCurrentWeek,
    syncAllTransactionsCurrentWeek
} from './sync.service.js';

let scheduledJobs: cron.ScheduledTask[] = [];

/**
 * Helper to get current time and weekday in Brasília Time (America/Sao_Paulo)
 */
export function getBrtTime(): { weekday: string; timeStr: string; hour: number; minute: number } {
    const now = new Date();
    const weekday = now.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }); // Sun, Mon, Tue, etc.
    const timeStr = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    const [hourStr, minStr] = timeStr.split(':');
    return {
        weekday,
        timeStr,
        hour: parseInt(hourStr, 10),
        minute: parseInt(minStr, 10)
    };
}

/**
 * Checks and dispatches weekly editorial slots based on Brasília Time (America/Sao_Paulo)
 */
export async function checkAndDispatchBotSchedule(): Promise<number> {
    const { weekday, timeStr, hour, minute } = getBrtTime();
    const activeLeagues = query('SELECT * FROM leagues WHERE is_active = 1') as any[];
    if (activeLeagues.length === 0) return 0;

    const nflState = queryOne('SELECT * FROM nfl_state WHERE id = 1') as any;
    const currentWeek = nflState?.week || 1;
    let dispatchedCount = 0;
    const now = new Date();
    const nowMs = Date.now();
    const todayBrtDateStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); // "DD/MM/YYYY"

    for (const league of activeLeagues) {
        const season = league.season || nflState?.season || '2026';
        const firstDay = weeklySchedule.getFirstGameDay(season, currentWeek);
        const sundayTimes = weeklySchedule.getSundayScheduleTimes(season, currentWeek);

        // Helper to dispatch if not already sent
        const tryDispatch = (slotKey: string, messageGen: () => any) => {
            const alreadyLogged = queryOne(
                'SELECT id FROM bot_message_log WHERE league_id = ? AND slot_key = ? AND season = ? AND week = ?',
                [league.league_id, slotKey, season, currentWeek]
            );

            if (!alreadyLogged) {
                const res = messageGen();
                execute(
                    `INSERT OR REPLACE INTO bot_message_log (
                        league_id, slot_key, season, week, message_type, message_text, metadata, sent_at, status
                    ) VALUES (?, ?, ?, ?, 'scheduled', ?, ?, datetime('now'), 'sent')`,
                    [
                        league.league_id,
                        slotKey,
                        season,
                        currentWeek,
                        res.message_text,
                        JSON.stringify({ title: res.title, brtTime: timeStr, teaser: res.teaser_next })
                    ]
                );
                console.log(`📢 [BOT DISPATCHER] Sent "${res.title}" to league "${league.name}" (Slot: ${slotKey})`);
                dispatchedCount++;
            }
        };

        // 1. Terça-feira 08:00 BRT - Fechamento Ácido da Rodada
        // Dispara no primeiro tick da hora das 08h BRT; garantido pelo registro de envio único
        if (weekday === 'Tue' && hour === 8) {
            tryDispatch('tue_08h_recap', () => weeklySchedule.generateTuesdayRecap(league.league_id, currentWeek));
        }

        // 2. Quarta-feira 08:00 BRT - Radar do Waiver Wire
        if (weekday === 'Wed' && hour === 8) {
            tryDispatch('wed_08h_waiver_radar', () => weeklySchedule.generateWednesdayWaiverRadar(league.league_id));
        }

        // 3. Dia do Kickoff da Semana (Dinâmico: Quinta, Quarta, Sexta...)
        // Validação rigorosa por data do calendário em Brasília ou fallback para quinta-feira
        const isKickoffDay = firstDay.dateStr
            ? (todayBrtDateStr === firstDay.dateStr)
            : (weekday === 'Thu');

        if (isKickoffDay) {
            if (hour === 8) {
                tryDispatch('opening_08h_waivers', () => weeklySchedule.generateOpeningDay08hWaivers(league.league_id, currentWeek));
            } else if (hour === 9) {
                tryDispatch('opening_09h_standings', () => weeklySchedule.generateOpeningDay09hStandings(league.league_id, currentWeek));
            } else if (hour === 10) {
                tryDispatch('opening_10h_matchups', () => weeklySchedule.generateOpeningDay10hMatchups(league.league_id, currentWeek));
            } else if (hour === 11) {
                tryDispatch('opening_11h_injuries', () => weeklySchedule.generateOpeningDay11hInjuries(league.league_id, currentWeek));
            } else if (hour === 12) {
                tryDispatch('opening_12h_trashtalk', () => weeklySchedule.generateOpeningDay12hTrashTalk(league.league_id, currentWeek));
            }
        }

        // 4. Domingo de Manhã (Slots 8 a 12 com Horários Dinâmicos e Proteção de Fuso Brasil)
        if (weekday === 'Sun') {
            // Slot 8: 08:00 BRT - Waivers Sábado p/ Domingo & Rescaldo
            if (hour === 8) {
                tryDispatch('sun_08h_waivers_recap', () => weeklySchedule.generateSunday08hWaiversAndRecap(league.league_id, currentWeek));
            }
            // Slot 9: Card de Confrontos Atualizado com Parciais (09:00 BRT ou 08:30 se jogo cedo)
            if (sundayTimes.hasEarlyGame ? (hour === 8 && minute >= 30) : (hour === 9)) {
                tryDispatch('sun_09h_matchups_update', () => weeklySchedule.generateSunday09hMatchupCardUpdate(league.league_id, currentWeek));
            }
            // Slot 10: Boletim Médico Dominical (10:00 BRT ou 08:45 se jogo cedo)
            if (sundayTimes.hasEarlyGame ? (hour === 8 && minute >= 45) : (hour === 10)) {
                tryDispatch('sun_10h_injuries', () => weeklySchedule.generateSunday10hInjuries(league.league_id, currentWeek));
            }

            // Slot 11: Aquecimento & Trash Talk (Exatos 120 minutos / 2h antes do Kickoff em BRT)
            // GATILHO POR TIMESTAMP: Dispara a partir de (Kickoff - 120min) e antes do Kickoff
            const trashTalkMs = sundayTimes.trashTalkDate.getTime();
            const inactivesAlertMs = sundayTimes.inactivesAlertDate.getTime();
            const kickoffMs = sundayTimes.kickoffDate.getTime();

            if (nowMs >= trashTalkMs && nowMs < kickoffMs) {
                tryDispatch('sun_11h_trashtalk', () => weeklySchedule.generateSunday11hTrashTalk(league.league_id, currentWeek));
            }

            // Slot 12: ALERTA VERMELHO DE INATIVOS (Exatos 90 minutos antes do Kickoff em BRT)
            // GATILHO INFALÍVEL POR TIMESTAMP:
            // Dispara na PRIMEIRA execução do cron após a liberação oficial de inativos (Kickoff - 90min) até o Kickoff.
            // Ajusta-se perfeitamente às variações do fuso de Brasília:
            // - Setembro/Outubro (EDT): Kickoff às 14:00 BRT ➡️ Inativos às 12:30 BRT
            // - Novembro a Janeiro (EST): Kickoff às 15:00 BRT ➡️ Inativos às 13:30 BRT
            // - Jogos Internacionais (Londres): Kickoff às 10:30 BRT ➡️ Inativos às 09:00 BRT
            // Não falha por delays de cron de 5min, reinícios de processo ou jitter de relógio.
            if (nowMs >= inactivesAlertMs && nowMs < kickoffMs) {
                tryDispatch('sun_11h30_inactives', () => weeklySchedule.generateSundayInactivesAlert(league.league_id, currentWeek));
            }
        }

        // 5. Segunda-feira 08:00 BRT - Especial MNF
        if (weekday === 'Mon' && hour === 8) {
            tryDispatch('mon_08h_decisions', () => weeklySchedule.generateMondayDecisions(league.league_id, currentWeek));
        }
    }

    return dispatchedCount;
}

export function startScheduler(): void {
    console.log('⏰ Starting scheduler with Timezone-Aware Bot Editorial Dispatcher...\n');

    const playersCron = process.env.PLAYERS_SYNC_CRON || '0 4 * * *';
    const leaguesCron = process.env.LEAGUES_SYNC_CRON || '0 5 * * *';
    const trendingCron = process.env.TRENDING_SYNC_CRON || '0 * * * *';

    // Daily players sync (4 AM UTC)
    const playersJob = cron.schedule(playersCron, async () => {
        console.log('\n🔄 [CRON] Starting daily players sync...');
        try {
            await syncPlayers();
        } catch (error) {
            console.error('[CRON] Players sync failed:', error);
        }
    });
    scheduledJobs.push(playersJob);
    console.log(`   📅 Players sync: ${playersCron}`);

    // Daily leagues sync (5 AM UTC)
    const leaguesJob = cron.schedule(leaguesCron, async () => {
        console.log('\n🔄 [CRON] Starting daily leagues sync...');
        try {
            await syncNFLState();
            await syncAllLeagues();
            await syncAllMatchupsCurrentWeek();
            await syncAllTransactionsCurrentWeek();
        } catch (error) {
            console.error('[CRON] Leagues sync failed:', error);
        }
    });
    scheduledJobs.push(leaguesJob);
    console.log(`   📅 Leagues sync: ${leaguesCron}`);

    // Hourly trending sync
    const trendingJob = cron.schedule(trendingCron, async () => {
        console.log('\n🔄 [CRON] Starting trending players sync...');
        try {
            await syncTrending();
        } catch (error) {
            console.error('[CRON] Trending sync failed:', error);
        }
    });
    scheduledJobs.push(trendingJob);
    console.log(`   📅 Trending sync: ${trendingCron}`);

    // Bot Editorial Schedule Dispatcher (checks every 5 minutes)
    const botDispatcherJob = cron.schedule('*/5 * * * *', async () => {
        try {
            await checkAndDispatchBotSchedule();
        } catch (error) {
            console.error('[CRON] Bot schedule dispatcher error:', error);
        }
    });
    scheduledJobs.push(botDispatcherJob);
    console.log('   🤖 Bot Editorial Dispatcher: */5 * * * * (America/Sao_Paulo aligned)');

    // Smart Game Final Watcher (checks every 2 minutes for game endings)
    const gameWatcherJob = cron.schedule('*/2 * * * *', async () => {
        try {
            await gameWatcher.checkLiveGames();
        } catch (error) {
            console.error('[CRON] Game watcher error:', error);
        }
    });
    scheduledJobs.push(gameWatcherJob);
    console.log('   ⚡ Smart Game Watcher: */2 * * * * (Live ESPN Final Status Polling)');

    console.log('\n✅ Scheduler active with 5 jobs (Sync + Editorial Dispatcher + Smart Game Watcher)\n');
}

export function stopScheduler(): void {
    scheduledJobs.forEach(job => job.stop());
    scheduledJobs = [];
    console.log('⏰ Scheduler stopped');
}

// Get scheduler status
export function getSchedulerStatus(): { job: string; cron: string; description?: string }[] {
    return [
        { job: 'Players Sync', cron: process.env.PLAYERS_SYNC_CRON || '0 4 * * *', description: 'Sync all NFL players from Sleeper' },
        { job: 'Leagues Sync', cron: process.env.LEAGUES_SYNC_CRON || '0 5 * * *', description: 'Sync league rosters, matchups, transactions' },
        { job: 'Trending Sync', cron: process.env.TRENDING_SYNC_CRON || '0 * * * *', description: 'Hourly trending player adds/drops' },
        { job: 'Bot Editorial Dispatcher', cron: '*/5 * * * *', description: 'Dispatches 13 weekly WhatsApp editorial slots dynamically' },
        { job: 'Smart Game Watcher', cron: '*/2 * * * *', description: 'Instant flash trigger on NFL game finals' }
    ];
}
