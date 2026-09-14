import { weeklySchedule } from '../services/weekly-schedule.service.js';
import { queryOne, closeDb } from '../config/database.js';

async function testFullWeeklySchedule() {
    console.log('🤖 Running Full Weekly Editorial Schedule Preview...\n');

    const league = (queryOne(`
        SELECT l.league_id, l.name, l.season 
        FROM leagues l
        JOIN matchups m ON l.league_id = m.league_id
        WHERE m.week = 1
        GROUP BY l.league_id
        ORDER BY l.season DESC
        LIMIT 1
    `) as any) || (queryOne("SELECT league_id, name, season FROM leagues ORDER BY season DESC LIMIT 1") as any);

    if (!league) {
        console.error('League not found!');
        return;
    }

    const week = 1;
    const firstDay = weeklySchedule.getFirstGameDay(league.season, week);
    console.log(`🏆 Target League: ${league.name} (${league.season}, ID: ${league.league_id})`);
    console.log(`🏈 Kickoff Day: ${firstDay.dayName} (${firstDay.dateStr})\n`);

    const slots = [
        { name: '1. TERÇA 08:00 - Fechamento Geral Ácido & Raio-X Completo (NFL + Fantasy + Trash Talk)', fn: () => weeklySchedule.generateTuesdayRecap(league.league_id, week) },
        { name: '2. QUARTA 08:00 - Radar do Waiver Wire (Alvos Mais Cobiçados)', fn: () => weeklySchedule.generateWednesdayWaiverRadar(league.league_id) },
        { name: `3. PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) 08:00 - Bloco 1: Plantão do Waiver Wire`, fn: () => weeklySchedule.generateOpeningDay08hWaivers(league.league_id, week) },
        { name: `4. PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) 09:00 - Bloco 2: Termômetro da Liga & Disputa de Classificação`, fn: () => weeklySchedule.generateOpeningDay09hStandings(league.league_id, week) },
        { name: `5. PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) 10:00 - Bloco 3: Card de Confrontos & Rivalidades Históricas (H2H)`, fn: () => weeklySchedule.generateOpeningDay10hMatchups(league.league_id, week) },
        { name: `6. PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) 11:00 - Bloco 4: Boletim Médico & Dúvidas dos Titulares`, fn: () => weeklySchedule.generateOpeningDay11hInjuries(league.league_id, week) },
        { name: `7. PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) 12:00 - Bloco 5: Trash Talk & Palpites do Hermes`, fn: () => weeklySchedule.generateOpeningDay12hTrashTalk(league.league_id, week) },
        { name: '8. DOMINGO 08:00 - Bloco 1: Waivers de Sábado p/ Domingo & Rescaldo dos Primeiros Jogos', fn: () => weeklySchedule.generateSunday08hWaiversAndRecap(league.league_id, week) },
        { name: '9. DOMINGO 09:00 - Bloco 2: Card de Confrontos Atualizado com Parciais da Rodada', fn: () => weeklySchedule.generateSunday09hMatchupCardUpdate(league.league_id, week) },
        { name: '10. DOMINGO 10:00 - Bloco 3: Boletim Médico Dominical (Últimas Notícias)', fn: () => weeklySchedule.generateSunday10hInjuries(league.league_id) },
        { name: '11. DOMINGO 11:00 - Bloco 4: Trash Talk & Aquecimento Pré-Kickoff do Domingo', fn: () => weeklySchedule.generateSunday11hTrashTalk(league.league_id, week) },
        { name: '12. DOMINGO 11:30 - Alerta Vermelho de Inativos (90 minutos pro Kickoff)', fn: () => weeklySchedule.generateSundayInactivesAlert(league.league_id) },
        { name: '13. SEGUNDA 08:00 - Especial: Decididos vs Dramas em Aberto no MNF', fn: () => weeklySchedule.generateMondayDecisions(league.league_id, week) }
    ];

    for (const slot of slots) {
        console.log('================================================================================');
        console.log(`📅 ${slot.name}`);
        console.log('================================================================================');
        const res = slot.fn();
        console.log(res.message_text);
        if (res.teaser_next) {
            console.log(`\n🔗 Gancho Próxima Matéria: "${res.teaser_next}"`);
        }
        console.log('\n');
    }

    closeDb();
}

testFullWeeklySchedule();
