import cron from 'node-cron';
import {
    syncPlayers,
    syncAllLeagues,
    syncTrending,
    syncNFLState,
    syncAllMatchupsCurrentWeek,
    syncAllTransactionsCurrentWeek
} from './sync.service.js';

let scheduledJobs: cron.ScheduledTask[] = [];

export function startScheduler(): void {
    console.log('⏰ Starting scheduler...\n');

    const playersCron = process.env.PLAYERS_SYNC_CRON || '0 4 * * *';
    const leaguesCron = process.env.LEAGUES_SYNC_CRON || '0 5 * * *';
    const trendingCron = process.env.TRENDING_SYNC_CRON || '0 * * * *';

    // Daily players sync (4 AM UTC by default)
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

    // Daily leagues sync (5 AM UTC by default)
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

    console.log('\n✅ Scheduler started with 3 jobs\n');
}

export function stopScheduler(): void {
    scheduledJobs.forEach(job => job.stop());
    scheduledJobs = [];
    console.log('⏰ Scheduler stopped');
}

// Get next run times for all jobs
export function getSchedulerStatus(): { job: string; cron: string }[] {
    return [
        { job: 'Players Sync', cron: process.env.PLAYERS_SYNC_CRON || '0 4 * * *' },
        { job: 'Leagues Sync', cron: process.env.LEAGUES_SYNC_CRON || '0 5 * * *' },
        { job: 'Trending Sync', cron: process.env.TRENDING_SYNC_CRON || '0 * * * *' },
    ];
}
