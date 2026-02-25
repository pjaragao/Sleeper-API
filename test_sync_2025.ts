import { addLeague } from './src/services/sync.service.js';

async function test() {
    try {
        console.log('Starting manual sync for 2025...');
        await addLeague('1180282402537496576', false);
        console.log('Sync successful!');
    } catch (e) {
        console.error('Sync failed with error:', e);
    }
}

test();
