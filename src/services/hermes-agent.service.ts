import { leagueAnalytics } from './league-analytics.service.js';
import { nflCollector } from './nfl-collector.service.js';
import { newsScraper } from './news-scraper.service.js';
import { queryOne } from '../config/database.js';

export class HermesAgentService {
    /**
     * Formats a complete WhatsApp Weekly Recap ready to send to a league group
     */
    formatWhatsAppWeeklyRecap(leagueId: string, week: number): string {
        const recap = leagueAnalytics.getWeeklyRecap(leagueId, week);
        if (!recap) return '❌ Nenhum dado encontrado para esta semana.';

        const lines: string[] = [
            `🚨 *GIRO DA RODADA: ${recap.league_name.toUpperCase()}* 🚨`,
            `📅 *Semana ${week} (${recap.season})*`,
            ''
        ];

        if (recap.topScorer) {
            lines.push(`👑 *O Amassador da Rodada:* *${recap.topScorer.manager}* com colossais *${recap.topScorer.points} pts*! Botou todo mundo pra mamar.`);
        }

        if (recap.lowestScorer) {
            lines.push(`🥔 *O Saco de Pancadas:* *${recap.lowestScorer.manager}* fez vergonhosos *${recap.lowestScorer.points} pts*. Nem o kicker ajudou.`);
        }

        lines.push('', '⚔️ *PLACAR DOS CONFRONTOS:*');
        for (const m of recap.matchups) {
            const isBlowout = m.margin > 35;
            const isThriller = m.margin < 5;
            const tag = isBlowout ? '💥 [MASSACRE]' : isThriller ? '🔥 [NO SUFOCO]' : '✅';
            lines.push(`${tag} *${m.manager_a}* (${m.points_a}) vs (${m.points_b}) *${m.manager_b}* ➡️ Vencedor: *${m.winner}* (+${m.margin} pts)`);
        }

        if (recap.transactions_count > 0) {
            lines.push('', `⚡ *Movimentações na Semana:* ${recap.transactions_count} alterações nos elencos.`);
        }

        lines.push('', '💬 _Comentário do Bot Hermes: Preparem as cornetas pro grupo que a semana promete!_');
        return lines.join('\n');
    }

    /**
     * Formats an instant Trade Verdict for WhatsApp
     */
    formatWhatsAppTradeVerdict(tradeId: string): string {
        const t = queryOne(`
            SELECT t.*, l.name as league_name, l.season
            FROM transactions t
            JOIN leagues l ON t.league_id = l.league_id
            WHERE t.transaction_id = ?
        `, [tradeId]) as any;

        if (!t) return '❌ Troca não encontrada.';

        const rosterIds: number[] = (t.roster_ids ? JSON.parse(t.roster_ids) : null) || [];
        const adds: Record<string, number> = (t.adds ? JSON.parse(t.adds) : null) || {};
        const draftPicks: any[] = (t.draft_picks ? JSON.parse(t.draft_picks) : null) || [];
        const waiverBudget: any[] = (t.waiver_budget ? JSON.parse(t.waiver_budget) : null) || [];

        const lines: string[] = [
            '🚨 *BOMBA NA LIGA: TROCA CONFIRMADA!* 🚨',
            `🏆 Liga: *${t.league_name}* (Semana ${t.week || 'Offseason'})`,
            ''
        ];

        for (const rid of rosterIds) {
            const roster = queryOne(`
                SELECT COALESCE(u.display_name, 'Time ' || r.roster_id) as manager
                FROM rosters r
                LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
                WHERE r.league_id = ? AND r.roster_id = ?
            `, [t.league_id, rid]) as any;

            const managerName = roster?.manager || `Time ${rid}`;
            const receivedPlayers = Object.entries(adds)
                .filter(([_, destRid]) => destRid === rid)
                .map(([pid]) => {
                    const p = queryOne('SELECT full_name, position, team FROM players WHERE player_id = ?', [pid]) as any;
                    return p ? `${p.full_name} (${p.position} - ${p.team})` : `Player ${pid}`;
                });

            const receivedPicks = draftPicks
                .filter(dp => dp.owner_id === rid)
                .map(dp => `Pick Round ${dp.round} (${dp.season})`);

            const receivedFaab = waiverBudget
                .filter(wb => wb.receiver === rid)
                .map(wb => `$${wb.amount} FAAB`);

            const totalAssets = [...receivedPlayers, ...receivedPicks, ...receivedFaab];

            lines.push(`👤 *${managerName}* recebeu:`);
            if (totalAssets.length === 0) {
                lines.push('  - _(Nenhum ativo listado)_');
            } else {
                for (const asset of totalAssets) {
                    lines.push(`  - ✅ ${asset}`);
                }
            }
            lines.push('');
        }

        lines.push('⚖️ *Veredito do Bot Hermes:* Negócio fechado! Se foi golpe ou visão de futuro, o tempo dirá. Mas tem gente no grupo que já tá chorando!');
        return lines.join('\n');
    }

    /**
     * Formats Matchup Preview & Trash Talk
     */
    formatWhatsAppMatchupPreview(leagueSlug: string, managerA: string, managerB: string): string {
        const families = leagueAnalytics.getLeagueFamilies();
        const family = families.find(f => f.slug === leagueSlug);
        if (!family) return `❌ Liga ${leagueSlug} não encontrada.`;

        const h2h = leagueAnalytics.getH2HMatrix(family);
        const record = h2h.find(r => 
            (r.manager_a.toLowerCase() === managerA.toLowerCase() && r.manager_b.toLowerCase() === managerB.toLowerCase()) ||
            (r.manager_a.toLowerCase() === managerB.toLowerCase() && r.manager_b.toLowerCase() === managerA.toLowerCase())
        );

        const lines: string[] = [
            '🔥 *DUELO DA RODADA: CLÁSSICO HISTÓRICO!* 🔥',
            `⚔️ *${managerA}* VS *${managerB}*`,
            ''
        ];

        if (record) {
            lines.push(
                '📊 *Histórico Acumulado (Head-to-Head):*',
                `- Total de Jogos: *${record.games_played}* confrontos`,
                `- Placar Histórico: *${record.manager_a}* (${record.wins_a}) x (${record.wins_b}) *${record.manager_b}* (Empates: ${record.ties})`,
                `- Pontos Somados: ${Math.round(record.total_points_a)} x ${Math.round(record.total_points_b)}`
            );

            if (record.biggest_blowout) {
                lines.push(`- Maior Massacre Histórico: *${record.biggest_blowout.winner}* amassou por +${record.biggest_blowout.margin} pts (${record.biggest_blowout.season} W${record.biggest_blowout.week})`);
            }
            if (record.closest_match) {
                lines.push(`- Jogo Mais Tenso: *${record.closest_match.winner}* levou por apenas +${record.closest_match.margin} pts (${record.closest_match.season} W${record.closest_match.week})`);
            }
        } else {
            lines.push('ℹ️ _Primeiro confronto oficial registrado entre esses dois nesta liga! Sem histórico prévio._');
        }

        lines.push('', '🍿 _Façam suas apostas no grupo!_');
        return lines.join('\n');
    }
}

export const hermesAgent = new HermesAgentService();
