/**
 * Diagnostic script to check if the Sleeper API provides certain fields
 * that appear NULL in the local database (birth_country, espn_id, yahoo_id, etc.)
 */
import axios from 'axios';

interface PlayerData {
    player_id: string;
    first_name: string;
    last_name: string;
    position: string;
    team: string;
    birth_country?: string;
    espn_id?: string;
    yahoo_id?: string;
    rotowire_id?: string;
    rotoworld_id?: string;
    stats_id?: string;
    [key: string]: unknown;
}

async function diagnoseApiFields() {
    console.log('🔍 Diagnosing Sleeper API player fields...\n');

    try {
        // Fetch all players from Sleeper API
        console.log('📡 Fetching players from Sleeper API...');
        const response = await axios.get<Record<string, PlayerData>>('https://api.sleeper.app/v1/players/nfl');
        const players = response.data;

        const playerIds = Object.keys(players);
        console.log(`✅ Fetched ${playerIds.length} players\n`);

        // Fields we want to check
        const fieldsToCheck = [
            'birth_country',
            'espn_id',
            'yahoo_id',
            'rotowire_id',
            'rotoworld_id',
            'stats_id',
            'sportradar_id',
            'fantasy_data_id'
        ];

        // Count how many players have each field populated
        const fieldStats: Record<string, { populated: number; samples: string[] }> = {};

        for (const field of fieldsToCheck) {
            fieldStats[field] = { populated: 0, samples: [] };
        }

        // Also track active NFL players (those with a team)
        let activePlayersCount = 0;
        const activeFieldStats: Record<string, { populated: number; samples: string[] }> = {};

        for (const field of fieldsToCheck) {
            activeFieldStats[field] = { populated: 0, samples: [] };
        }

        for (const id of playerIds) {
            const player = players[id];
            const isActive = !!player.team && player.team !== '';

            if (isActive) {
                activePlayersCount++;
            }

            for (const field of fieldsToCheck) {
                const value = player[field];
                if (value !== undefined && value !== null && value !== '') {
                    fieldStats[field].populated++;
                    if (fieldStats[field].samples.length < 3) {
                        fieldStats[field].samples.push(`${player.first_name} ${player.last_name}: ${value}`);
                    }

                    if (isActive) {
                        activeFieldStats[field].populated++;
                        if (activeFieldStats[field].samples.length < 3) {
                            activeFieldStats[field].samples.push(`${player.first_name} ${player.last_name} (${player.team}): ${value}`);
                        }
                    }
                }
            }
        }

        // Print results
        console.log('='.repeat(80));
        console.log('📊 FIELD AVAILABILITY REPORT (ALL PLAYERS)');
        console.log('='.repeat(80));
        console.log(`Total players in API: ${playerIds.length}`);
        console.log(`Active players (with team): ${activePlayersCount}\n`);

        for (const field of fieldsToCheck) {
            const stats = fieldStats[field];
            const percentage = ((stats.populated / playerIds.length) * 100).toFixed(2);
            console.log(`\n📌 ${field}:`);
            console.log(`   Populated: ${stats.populated}/${playerIds.length} (${percentage}%)`);
            if (stats.samples.length > 0) {
                console.log(`   Sample values:`);
                for (const sample of stats.samples) {
                    console.log(`      - ${sample}`);
                }
            } else {
                console.log(`   ⚠️  NO VALUES FOUND - API does not provide this field!`);
            }
        }

        console.log('\n');
        console.log('='.repeat(80));
        console.log('📊 FIELD AVAILABILITY REPORT (ACTIVE PLAYERS ONLY)');
        console.log('='.repeat(80));
        console.log(`Active players: ${activePlayersCount}\n`);

        for (const field of fieldsToCheck) {
            const stats = activeFieldStats[field];
            const percentage = activePlayersCount > 0
                ? ((stats.populated / activePlayersCount) * 100).toFixed(2)
                : '0.00';
            console.log(`\n📌 ${field}:`);
            console.log(`   Populated: ${stats.populated}/${activePlayersCount} (${percentage}%)`);
            if (stats.samples.length > 0) {
                console.log(`   Sample values:`);
                for (const sample of stats.samples) {
                    console.log(`      - ${sample}`);
                }
            } else {
                console.log(`   ⚠️  NO VALUES FOUND for active players!`);
            }
        }

        // Show a single player example with all fields
        console.log('\n');
        console.log('='.repeat(80));
        console.log('📋 SAMPLE PLAYER RAW DATA (Patrick Mahomes)');
        console.log('='.repeat(80));

        // Find Patrick Mahomes or another known player
        const mahomes = Object.values(players).find(
            p => p.first_name === 'Patrick' && p.last_name === 'Mahomes'
        );

        if (mahomes) {
            console.log(JSON.stringify(mahomes, null, 2));
        } else {
            // Just pick the first active player
            const firstActive = Object.values(players).find(p => p.team);
            if (firstActive) {
                console.log(`(Patrick Mahomes not found, showing ${firstActive.first_name} ${firstActive.last_name})`);
                console.log(JSON.stringify(firstActive, null, 2));
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

diagnoseApiFields();
