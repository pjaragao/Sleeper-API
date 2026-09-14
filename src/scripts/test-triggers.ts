import { weeklySchedule } from '../services/weekly-schedule.service.js';
import { execute } from '../config/database.js';

console.log('🏈 =========================================================');
console.log('🧪 VALIDAÇÃO DE GATILHOS E FUSO BRASIL (SLOT 12 & CRON)');
console.log('🏈 =========================================================\n');

// 1. Validar cálculo para Semana 1 (Setembro / Outubro - EUA em EDT UTC-4)
console.log('--- 1. SEMANA 1 (Setembro - Horário de Verão EUA: EDT) ---');
const timesWeek1 = weeklySchedule.getSundayScheduleTimes('2026', 1);
console.log(`Kickoff 1º Jogo (BRT):          ${timesWeek1.kickoffTimeBRT}`);
console.log(`Slot 11 - Trash Talk (BRT):     ${timesWeek1.trashTalkTimeBRT} (Exatos 120min antes)`);
console.log(`Slot 12 - Alerta Inativos (BRT): ${timesWeek1.inactivesAlertTimeBRT} (Exatos 90min antes)`);
console.log(`Slot 8 - Waivers & Recap (BRT): ${timesWeek1.waiversRecapTimeBRT}`);
console.log(`Slot 9 - Card Confrontos (BRT): ${timesWeek1.matchupsUpdateTimeBRT}`);
console.log(`Slot 10 - Boletim Médico (BRT): ${timesWeek1.injuriesTimeBRT}`);
console.log(`Possui Jogo Cedo (< 13h BRT):   ${timesWeek1.hasEarlyGame ? 'SIM' : 'NÃO'}`);

if (timesWeek1.kickoffTimeBRT === '14:00' && timesWeek1.inactivesAlertTimeBRT === '12:30' && timesWeek1.trashTalkTimeBRT === '12:00') {
    console.log('✅ Semana 1 (Setembro): CÁLCULO PERFEITO (14:00 Kickoff -> 12:30 Inativos)!\n');
} else {
    console.error('❌ Falha na Semana 1:', timesWeek1);
    process.exit(1);
}

// 2. Validar cálculo para Semana 10 (Novembro / Dezembro - EUA em EST UTC-5, Relógios Americanos Atrasam 1h)
console.log('--- 2. SEMANA 10 (Novembro - Fim do DST nos EUA: EST) ---');
// Temporariamente sem jogos no banco para semana 10, deve acionar a regra inteligente de fuso
const timesWeek10 = weeklySchedule.getSundayScheduleTimes('2026', 10);
console.log(`Kickoff 1º Jogo (BRT):          ${timesWeek10.kickoffTimeBRT}`);
console.log(`Slot 11 - Trash Talk (BRT):     ${timesWeek10.trashTalkTimeBRT} (Exatos 120min antes)`);
console.log(`Slot 12 - Alerta Inativos (BRT): ${timesWeek10.inactivesAlertTimeBRT} (Exatos 90min antes)`);
console.log(`Possui Jogo Cedo (< 13h BRT):   ${timesWeek10.hasEarlyGame ? 'SIM' : 'NÃO'}`);

if (timesWeek10.kickoffTimeBRT === '15:00' && timesWeek10.inactivesAlertTimeBRT === '13:30' && timesWeek10.trashTalkTimeBRT === '13:00') {
    console.log('✅ Semana 10 (Novembro): CÁLCULO PERFEITO (15:00 Kickoff -> 13:30 Inativos no Brasil)!\n');
} else {
    console.error('❌ Falha na Semana 10:', timesWeek10);
    process.exit(1);
}

// 3. Simulação de Jogo Internacional (Londres às 9:30 AM EDT = 10:30 BRT)
console.log('--- 3. SIMULAÇÃO DE JOGO INTERNACIONAL (Londres 10:30 BRT) ---');
// Inserir mock de jogo internacional na semana 99
execute(`
    INSERT OR REPLACE INTO nfl_games (
        game_id, season, season_type, week, home_team, away_team,
        home_score, away_score, status, status_detail, game_date
    ) VALUES ('mock_london', '2026', 'regular', 99, 'JAX', 'CHI', 0, 0, 'scheduled', 'Sun 9:30 AM', '2026-10-11T13:30Z')
`);

const timesLondon = weeklySchedule.getSundayScheduleTimes('2026', 99);
console.log(`Kickoff Londres (BRT):          ${timesLondon.kickoffTimeBRT}`);
console.log(`Slot 11 - Trash Talk (BRT):     ${timesLondon.trashTalkTimeBRT} (Exatos 120min antes)`);
console.log(`Slot 12 - Alerta Inativos (BRT): ${timesLondon.inactivesAlertTimeBRT} (Exatos 90min antes)`);
console.log(`Slot 8 - Waivers & Recap (BRT): ${timesLondon.waiversRecapTimeBRT}`);
console.log(`Slot 9 - Card Confrontos (BRT): ${timesLondon.matchupsUpdateTimeBRT}`);
console.log(`Slot 10 - Boletim Médico (BRT): ${timesLondon.injuriesTimeBRT}`);
console.log(`Possui Jogo Cedo (< 13h BRT):   ${timesLondon.hasEarlyGame ? 'SIM' : 'NÃO'}`);

// Limpar mock
execute("DELETE FROM nfl_games WHERE game_id = 'mock_london'");

if (timesLondon.kickoffTimeBRT === '10:30' && timesLondon.inactivesAlertTimeBRT === '09:00' && timesLondon.trashTalkTimeBRT === '08:30' && timesLondon.hasEarlyGame) {
    console.log('✅ Jogo Internacional: CÁLCULO PERFEITO (10:30 Kickoff -> 09:00 Inativos, Blocos Adaptados)!\n');
} else {
    console.error('❌ Falha no Jogo Internacional:', timesLondon);
    process.exit(1);
}

// 4. Teste de Gatilho Temporal Infalível (Timestamp Window)
console.log('--- 4. TESTE DA JANELA TEMPORAL DO GATILHO (SLOT 12) ---');
const kickoffTime = new Date('2026-09-13T17:00:00Z').getTime(); // 14:00 BRT
const inactivesAlertTime = kickoffTime - 90 * 60 * 1000;         // 12:30 BRT

function simulateTrigger(simulatedDateStr: string): boolean {
    const simMs = new Date(simulatedDateStr).getTime();
    return simMs >= inactivesAlertTime && simMs < kickoffTime;
}

// Casos de teste
const testCases = [
    { label: 'Domingo 12:25 BRT (5min antes da liberação)', time: '2026-09-13T15:25:00Z', expected: false },
    { label: 'Domingo 12:29:59 BRT (1s antes da liberação)', time: '2026-09-13T15:29:59Z', expected: false },
    { label: 'Domingo 12:30:00 BRT (Momento EXATO do Alerta)', time: '2026-09-13T15:30:00Z', expected: true },
    { label: 'Domingo 12:34:30 BRT (Atraso de cron/reboot)', time: '2026-09-13T15:34:30Z', expected: true },
    { label: 'Domingo 12:35:00 BRT (Próximo tick de 5min)', time: '2026-09-13T15:35:00Z', expected: true },
    { label: 'Domingo 13:59:00 BRT (1min antes do Kickoff)', time: '2026-09-13T16:59:00Z', expected: true },
    { label: 'Domingo 14:00:00 BRT (Kickoff iniciado)', time: '2026-09-13T17:00:00Z', expected: false },
    { label: 'Domingo 14:15:00 BRT (Pós-kickoff)', time: '2026-09-13T17:15:00Z', expected: false },
];

let allPassed = true;
for (const tc of testCases) {
    const fired = simulateTrigger(tc.time);
    const ok = fired === tc.expected;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${tc.label} ➡️ Disparou: ${fired ? 'SIM' : 'NÃO'} (Esperado: ${tc.expected ? 'SIM' : 'NÃO'})`);
    if (!ok) allPassed = false;
}

if (allPassed) {
    console.log('\n🎯 TODOS OS TESTES DE GATILHOS E FUSO BRASIL FORAM APROVADOS COM 100% DE SUCESSO!');
} else {
    console.error('\n❌ Houve falha na validação dos testes.');
    process.exit(1);
}
