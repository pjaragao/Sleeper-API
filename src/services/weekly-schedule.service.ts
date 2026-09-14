import { query, queryOne } from '../config/database.js';
import { leagueAnalytics, LeagueFamily } from './league-analytics.service.js';
import { nflCollector } from './nfl-collector.service.js';
import { newsScraper } from './news-scraper.service.js';

export interface ScheduledMessageResult {
    slot_key: string;
    title: string;
    message_text: string;
    target_time?: string;
    teaser_next?: string;
}

export interface SundayScheduleTimes {
    hasEarlyGame: boolean;
    kickoffTimeBRT: string;
    inactivesAlertTimeBRT: string;
    trashTalkTimeBRT: string;
    waiversRecapTimeBRT: string;
    matchupsUpdateTimeBRT: string;
    injuriesTimeBRT: string;
    earliestGame?: any;
    kickoffDate: Date;
    inactivesAlertDate: Date;
    trashTalkDate: Date;
    waiversRecapDate: Date;
    matchupsUpdateDate: Date;
    injuriesDate: Date;
}

export class WeeklyScheduleService {
    /**
     * Helper to get active league info and its family
     */
    private getLeagueContext(leagueId: string): { league: any; family?: LeagueFamily } {
        const league = queryOne('SELECT * FROM leagues WHERE league_id = ?', [leagueId]) as any;
        if (!league) throw new Error(`League ${leagueId} not found`);

        const families = leagueAnalytics.getLeagueFamilies();
        const family = families.find(f => f.seasons.some(s => s.league_id === leagueId)) || {
            name: league.name,
            slug: league.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            seasons: [{ season: league.season, league_id: league.league_id, status: league.status, total_rosters: league.total_rosters }]
        };

        return { league, family };
    }

    /**
     * Helper to resolve the correct NFL season for stats
     */
    private resolveNflSeason(leagueSeason: string, week: number): string {
        const statsSeason = queryOne(
            'SELECT season FROM nfl_player_stats WHERE season = ? AND week = ? LIMIT 1',
            [leagueSeason, week]
        ) as any;
        if (statsSeason?.season) return statsSeason.season;

        const anySeason = queryOne(
            'SELECT season FROM nfl_player_stats WHERE week = ? ORDER BY season DESC LIMIT 1',
            [week]
        ) as any;
        return anySeason?.season || leagueSeason;
    }

    /**
     * Helper to resolve the correct NFL season for games
     */
    private resolveNflGamesSeason(leagueSeason: string, week: number): string {
        const gameSeason = queryOne(
            'SELECT season FROM nfl_games WHERE season = ? AND week = ? LIMIT 1',
            [leagueSeason, week]
        ) as any;
        if (gameSeason?.season) return gameSeason.season;

        const anySeason = queryOne(
            'SELECT season FROM nfl_games WHERE week = ? ORDER BY season DESC LIMIT 1',
            [week]
        ) as any;
        return anySeason?.season || leagueSeason;
    }

    /**
     * Formats real player NFL stat details from Sleeper stats JSON
     */
    private formatPlayerDetailedStats(p: any): string {
        const st = p.stats ? (typeof p.stats === 'string' ? JSON.parse(p.stats) : p.stats) : {};
        const parts: string[] = [];

        if (p.position === 'QB') {
            if (st.pass_yd !== undefined) parts.push(`${st.pass_yd} yds pass`);
            if (st.pass_td) parts.push(`${st.pass_td} TD(s)`);
            if (st.pass_int) parts.push(`💥 ${st.pass_int} INT(s)`);
            if (st.rush_yd) parts.push(`${st.rush_yd} yds corr`);
            if (st.rush_td) parts.push(`${st.rush_td} TD(s) corr`);
        } else if (p.position === 'RB') {
            if (st.rush_yd !== undefined) parts.push(`${st.rush_yd} yds corr`);
            if (st.rush_td) parts.push(`${st.rush_td} TD(s) corr`);
            if (st.rec) parts.push(`${st.rec} rec (${st.rec_yd || 0} yds)`);
            if (st.rec_td) parts.push(`${st.rec_td} TD(s) rec`);
            if (st.fum_lost) parts.push(`💥 ${st.fum_lost} fumble perdido`);
        } else if (p.position === 'WR' || p.position === 'TE') {
            if (st.rec !== undefined) parts.push(`${st.rec} rec`);
            if (st.rec_yd !== undefined) parts.push(`${st.rec_yd} yds rec`);
            if (st.rec_td) parts.push(`${st.rec_td} TD(s)`);
            if (st.rush_yd) parts.push(`${st.rush_yd} yds corr`);
            if (st.fum_lost) parts.push(`💥 ${st.fum_lost} fumble perdido`);
        } else if (p.position === 'K') {
            if (st.fgm !== undefined) parts.push(`${st.fgm}/${st.fga || st.fgm} FG`);
            if (st.fgm_50p) parts.push(`${st.fgm_50p} de 50+ yds`);
            if (st.xpm !== undefined) parts.push(`${st.xpm} XP`);
        } else if (p.position === 'DEF') {
            if (st.def_sack) parts.push(`${st.def_sack} sacks`);
            if (st.def_int) parts.push(`${st.def_int} INTs`);
            if (st.def_td) parts.push(`${st.def_td} TD(s)`);
            if (st.pts_allowed !== undefined) parts.push(`${st.pts_allowed} pts cedidos`);
        }

        return parts.length > 0 ? `(${parts.join(', ')})` : '';
    }

    /**
     * Helper to get the date and day of the first game of the week (America/Sao_Paulo)
     */
    getFirstGameDay(season: string, week: number): { dayName: string; isThursday: boolean; dateStr: string; timeStr: string; gameDate?: string } {
        const gamesSeason = this.resolveNflGamesSeason(season, week);
        const firstGame = queryOne(`
            SELECT game_date FROM nfl_games 
            WHERE season = ? AND week = ? 
            ORDER BY game_date ASC LIMIT 1
        `, [gamesSeason, week]) as any;

        if (!firstGame?.game_date) {
            return { dayName: 'Quinta-feira', isThursday: true, dateStr: 'Quinta', timeStr: '21:20' };
        }

        const d = new Date(firstGame.game_date);
        const dayNameRaw = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });
        const dayName = dayNameRaw.charAt(0).toUpperCase() + dayNameRaw.slice(1);
        const timeStr = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        return {
            dayName,
            isThursday: dayName.toLowerCase().includes('quinta'),
            dateStr,
            timeStr,
            gameDate: firstGame.game_date
        };
    }

    /**
     * Helper to get Sunday's earliest kickoff and dynamic 90m alert times in Brasília Time (America/Sao_Paulo)
     * Respeita rigorosamente o fuso de Brasília (UTC-3 sem DST) e a transição americana (EDT -> EST em novembro):
     * - Semanas 1 a 8 (Set/Out - EDT): Kickoff às 14:00 BRT, Alerta de Inativos às 12:30 BRT, Trash Talk às 12:00 BRT.
     * - Semanas 9 a 18 (Nov a Jan - EST): Kickoff às 15:00 BRT, Alerta de Inativos às 13:30 BRT, Trash Talk às 13:00 BRT.
     * - Jogos Internacionais (Londres 9:30 AM ET): Kickoff às 10:30 BRT, Inativos às 09:00 BRT, Trash Talk às 08:30 BRT.
     */
    getSundayScheduleTimes(season: string, week: number): SundayScheduleTimes {
        const gamesSeason = this.resolveNflGamesSeason(season, week);
        const games = query(`
            SELECT * FROM nfl_games 
            WHERE season = ? AND week = ? 
            ORDER BY game_date ASC
        `, [gamesSeason, week]) as any[];

        const sundayGames = games.filter(g => {
            const d = new Date(g.game_date);
            const weekday = d.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
            return weekday === 'Sun';
        });

        let kickoffDate: Date;
        let earliest: any = undefined;

        if (sundayGames.length > 0) {
            earliest = sundayGames[0];
            kickoffDate = new Date(earliest.game_date);
        } else {
            // Fallback quando ainda não há jogos sincronizados no banco:
            // Regra de Fuso Brasil (UTC-3 fixo sem horário de verão):
            // - Semanas 1 a 8 (Set/Out): EUA em EDT (UTC-4). 1:00 PM EDT = 14:00 BRT (17:00 UTC).
            // - Semanas 9 a 18 (Nov a Jan): EUA em EST (UTC-5). 1:00 PM EST = 15:00 BRT (18:00 UTC).
            const targetUtcHour = Number(week) >= 9 ? 18 : 17;
            const now = new Date();
            const d = new Date(now);
            const dayOfWeek = d.getDay(); // 0 = Sunday
            const daysUntilSunday = dayOfWeek === 0 ? 0 : (7 - dayOfWeek);
            d.setDate(d.getDate() + daysUntilSunday);
            d.setUTCHours(targetUtcHour, 0, 0, 0);
            kickoffDate = d;
        }

        // Exatos 90 minutos antes do primeiro kickoff do domingão (divulgação da lista oficial de inativos)
        const inactivesAlertDate = new Date(kickoffDate.getTime() - 90 * 60 * 1000);
        // Exatos 120 minutos (2 horas) antes do primeiro kickoff (trash talk e aquecimento)
        const trashTalkDate = new Date(kickoffDate.getTime() - 120 * 60 * 1000);

        const kickoffTimeBRT = kickoffDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        const inactivesAlertTimeBRT = inactivesAlertDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        const trashTalkTimeBRT = trashTalkDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

        // Kickoff hour em Brasília para identificar jogos em Londres/internacionais cedo (< 13:00 BRT)
        const kickoffHourBRT = parseInt(kickoffTimeBRT.split(':')[0], 10);
        const hasEarlyGame = kickoffHourBRT < 13;

        // Horários matinais adaptados se houver jogo cedo (ex: Londres 10:30 BRT):
        // Jogo cedo (< 13h): Waivers 07:30, Confrontos 08:00, Boletim 08:30
        // Jogo normal (>= 13h): Waivers 08:00, Confrontos 09:00, Boletim 10:00
        const waiversRecapDate = hasEarlyGame
            ? new Date(trashTalkDate.getTime() - 60 * 60 * 1000)
            : new Date(new Date(kickoffDate).setUTCHours(11, 0, 0, 0)); // 08:00 BRT = 11:00 UTC
        const matchupsUpdateDate = hasEarlyGame
            ? new Date(trashTalkDate.getTime() - 30 * 60 * 1000)
            : new Date(new Date(kickoffDate).setUTCHours(12, 0, 0, 0)); // 09:00 BRT = 12:00 UTC
        const injuriesDate = hasEarlyGame
            ? trashTalkDate
            : new Date(new Date(kickoffDate).setUTCHours(13, 0, 0, 0)); // 10:00 BRT = 13:00 UTC

        const waiversRecapTimeBRT = waiversRecapDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        const matchupsUpdateTimeBRT = matchupsUpdateDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        const injuriesTimeBRT = injuriesDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

        return {
            hasEarlyGame,
            kickoffTimeBRT,
            inactivesAlertTimeBRT,
            trashTalkTimeBRT,
            waiversRecapTimeBRT,
            matchupsUpdateTimeBRT,
            injuriesTimeBRT,
            earliestGame: earliest,
            kickoffDate,
            inactivesAlertDate,
            trashTalkDate,
            waiversRecapDate,
            matchupsUpdateDate,
            injuriesDate
        };
    }

    /**
     * Helper to get Monday Night Football schedule in Brasília Time (America/Sao_Paulo)
     */
    getMnfGameTime(season: string, week: number): { hasMnf: boolean; gameStr?: string; timeBRT: string } {
        const gamesSeason = this.resolveNflGamesSeason(season, week);
        const games = query(`
            SELECT * FROM nfl_games 
            WHERE season = ? AND week = ? 
            ORDER BY game_date ASC
        `, [gamesSeason, week]) as any[];

        const mondayGames = games.filter(g => {
            const d = new Date(g.game_date);
            const weekday = d.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
            return weekday === 'Mon';
        });

        if (mondayGames.length === 0) {
            return { hasMnf: false, timeBRT: '21:15' };
        }

        const g = mondayGames[0];
        const d = new Date(g.game_date);
        const timeBRT = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        return {
            hasMnf: true,
            gameStr: `${g.away_team} @ ${g.home_team}`,
            timeBRT
        };
    }

    // =========================================================================
    // 1. TERÇA-FEIRA 08:00 - FECHAMENTO ÁCIDO E COMPLETO DA RODADA
    // =========================================================================
    generateTuesdayRecap(leagueId: string, week: number): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const recap = leagueAnalytics.getWeeklyRecap(leagueId, week);
        const nflSeason = this.resolveNflSeason(league.season, week);
        const gamesSeason = this.resolveNflGamesSeason(league.season, week);

        const lines: string[] = [
            `🚨 *FECHAMENTO GERAL DA RODADA: ${league.name.toUpperCase()}* 🚨`,
            `📅 *Semana ${week} (${league.season}) - O Veredito Ácido do Hermes*`,
            ''
        ];

        // 1. Destaques da Rodada no Fantasy
        if (recap?.topScorer) {
            lines.push(`👑 *Rei da Semana (O Amassador):* *${recap.topScorer.manager}* amassou com brutais *${recap.topScorer.points} pts*! Botou a banca pra chorar.`);
        }
        if (recap?.lowestScorer) {
            lines.push(`🥔 *Mico da Rodada (Saco de Pancadas):* *${recap.lowestScorer.manager}* fez vergonhosos *${recap.lowestScorer.points} pts*. O time nem entrou em campo, ficou no churrasco comendo pão de alho.`);
        }

        // 2. NFL Players Performance: Expectativa vs Realidade
        const outperformers = query(`
            SELECT 
                s.player_id,
                COALESCE(p.full_name, s.player_id) as full_name,
                COALESCE(p.position, 'FLEX') as position,
                COALESCE(p.team, 'NFL') as team,
                s.pts_ppr,
                s.stats,
                COALESCE(pr.proj_pts_ppr, 0) as proj_pts,
                ROUND(s.pts_ppr - COALESCE(pr.proj_pts_ppr, 0), 1) as diff
            FROM nfl_player_stats s
            LEFT JOIN nfl_player_projections pr ON s.player_id = pr.player_id AND s.season = pr.season AND s.week = pr.week
            LEFT JOIN players p ON s.player_id = p.player_id
            WHERE s.season = ? AND s.week = ? AND s.pts_ppr > 0 AND s.player_id NOT LIKE 'TEAM_%'
            ORDER BY diff DESC
            LIMIT 4
        `, [nflSeason, week]) as any[];

        const busts = query(`
            SELECT 
                s.player_id,
                COALESCE(p.full_name, s.player_id) as full_name,
                COALESCE(p.position, 'FLEX') as position,
                COALESCE(p.team, 'NFL') as team,
                s.pts_ppr,
                s.stats,
                COALESCE(pr.proj_pts_ppr, 0) as proj_pts,
                ROUND(s.pts_ppr - COALESCE(pr.proj_pts_ppr, 0), 1) as diff
            FROM nfl_player_stats s
            LEFT JOIN nfl_player_projections pr ON s.player_id = pr.player_id AND s.season = pr.season AND s.week = pr.week
            LEFT JOIN players p ON s.player_id = p.player_id
            WHERE s.season = ? AND s.week = ? AND s.player_id NOT LIKE 'TEAM_%' AND COALESCE(pr.proj_pts_ppr, 0) >= 10
            ORDER BY diff ASC
            LIMIT 4
        `, [nflSeason, week]) as any[];

        if (outperformers.length > 0 || busts.length > 0) {
            lines.push('', '🏈 *DESEMPENHO DOS JOGADORES NA NFL (Expectativa vs Realidade):*');
            if (outperformers.length > 0) {
                lines.push('🔥 *Os Quebradores de Banca (Estouraram a Boca do Balão):*');
                outperformers.forEach(p => {
                    const statStr = this.formatPlayerDetailedStats(p);
                    const commentary = p.diff >= 18
                        ? 'Demoliu a rodada parecendo um caminhão sem freio! Quem enfrentou tá chorando no chuveiro.'
                        : p.diff >= 12
                        ? 'Jogou como MVP e carregou as escalações nas costas.'
                        : 'Superou com muita folga o que os analistas de sofá projetavam.';
                    lines.push(`• **${p.full_name}** (${p.position}-${p.team}): Fez **${p.pts_ppr} pts** (Projeção: ${p.proj_pts}) ➡️ **+${p.diff} pts acima!** ${statStr}`);
                    lines.push(`   _${commentary}_`);
                });
            }
            if (busts.length > 0) {
                lines.push('', '🥶 *Os Pipocas & Fiascos da Rodada (Âncoras de Navio):*');
                busts.forEach(p => {
                    const statStr = this.formatPlayerDetailedStats(p);
                    const roast = p.diff <= -15
                        ? 'Uma verdadeira âncora de transatlântico! Parecia turista em campo e afundou quem escalou.'
                        : p.diff <= -10
                        ? 'Entregou a paçoca com requintes de crueldade. Quem escalou merece pagar o churrasco sozinho!'
                        : 'Pipocou miseravelmente e ficou olhando o jogo passar de camarote.';
                    lines.push(`• **${p.full_name}** (${p.position}-${p.team}): Fez pífios **${p.pts_ppr} pts** (Esperavam: ${p.proj_pts}) ➡️ **${p.diff} pts no ralo!** ${statStr}`);
                    lines.push(`   _${roast}_`);
                });
            }
        }

        // 3. NFL Teams: Surpresas, Massacres e Fiascos
        const games = nflCollector.getWeeklyGames(gamesSeason, week);
        const finishedGames = games.filter(g => g.status === 'final');
        if (finishedGames.length > 0) {
            lines.push('', '🏟️ *TIMES DA NFL (Surpresas, Massacres & Fiascos):*');

            // Tiroteio da Rodada
            const highestScoring = [...finishedGames].sort((a, b) => (b.home_score + b.away_score) - (a.home_score + a.away_score))[0];
            if (highestScoring && (highestScoring.home_score + highestScoring.away_score) > 0) {
                lines.push(`🎆 *O Tiroteio Insano:* **${highestScoring.away_team}** ${highestScoring.away_score} x ${highestScoring.home_score} **${highestScoring.home_team}** (${highestScoring.home_score + highestScoring.away_score} pts combinados!)`);
                lines.push('   _As defesas nem entraram no estádio, foi chuva de touchdown!_');
            }

            // Maior Massacre (Blowout)
            const blowouts = [...finishedGames].sort((a, b) => Math.abs(b.home_score - b.away_score) - Math.abs(a.home_score - a.away_score));
            const biggestBlowout = blowouts[0];
            if (biggestBlowout && Math.abs(biggestBlowout.home_score - biggestBlowout.away_score) >= 14) {
                const winner = biggestBlowout.home_score > biggestBlowout.away_score ? biggestBlowout.home_team : biggestBlowout.away_team;
                const loser = biggestBlowout.home_score > biggestBlowout.away_score ? biggestBlowout.away_team : biggestBlowout.home_team;
                const margin = Math.abs(biggestBlowout.home_score - biggestBlowout.away_score);
                lines.push(`💥 *O Massacre Real:* **${winner}** atropelou o **${loser}** por +${margin} pts (${Math.max(biggestBlowout.home_score, biggestBlowout.away_score)} x ${Math.min(biggestBlowout.home_score, biggestBlowout.away_score)})!`);
                lines.push(`   _Humilhação completa. O torcedor do ${loser} já tá pedindo demissão da comissão técnica inteira._`);
            }

            // Show de Horrores (Menor pontuação)
            const lowestScoring = [...finishedGames].filter(g => (g.home_score + g.away_score) > 0).sort((a, b) => (a.home_score + a.away_score) - (b.home_score + b.away_score))[0];
            if (lowestScoring) {
                lines.push(`💤 *O Jogo dos Horrores:* **${lowestScoring.away_team}** ${lowestScoring.away_score} x ${lowestScoring.home_score} **${lowestScoring.home_team}** (${lowestScoring.home_score + lowestScoring.away_score} pts somados!)`);
                lines.push('   _Quem assistiu essa atrocidade merece indenização. Festival de punts, erros grotescos e sono!_');
            }
        }

        // 4. Raio-X dos Confrontos da Liga (Humilhação, O Cagão, O Injustiçado)
        if (recap && recap.matchups.length > 0) {
            lines.push('', '⚔️ *RAIO-X DOS CONFRONTOS NO FANTASY:*');
            const sortedByMargin = [...recap.matchups].sort((a, b) => b.margin - a.margin);
            const biggestMassacre = sortedByMargin[0];
            const closestThriller = sortedByMargin[sortedByMargin.length - 1];

            if (biggestMassacre) {
                lines.push(`💥 *A Maior Humilhação:* *${biggestMassacre.winner}* passou a patrola com brutais +${biggestMassacre.margin} pts de vantagem sobre o rival!`);
            }
            if (closestThriller) {
                lines.push(`🔥 *No Sufoco do Milagre:* *${closestThriller.winner}* arrancou a vitória por míseros +${closestThriller.margin} pts! O rival tá chorando no travesseiro.`);
            }

            // O Cagão da Rodada (venceu com menos pontos)
            const winners = recap.matchups.map(m => {
                const isA = m.points_a > m.points_b;
                return {
                    winner: isA ? m.manager_a : m.manager_b,
                    loser: isA ? m.manager_b : m.manager_a,
                    winPoints: isA ? m.points_a : m.points_b,
                    losePoints: isA ? m.points_b : m.points_a
                };
            }).sort((a, b) => a.winPoints - b.winPoints);

            const luckiest = winners[0];
            if (luckiest) {
                lines.push(`🍀 *O Cagão da Rodada:* *${luckiest.winner}* venceu fazendo apenas **${luckiest.winPoints} pts**! Jogou nada, mas o rival fez incríveis ${luckiest.losePoints} pts.`);
            }

            // O Injustiçado da Rodada (perdeu com mais pontos)
            const losers = recap.matchups.map(m => {
                const isA = m.points_a > m.points_b;
                return {
                    loser: isA ? m.manager_b : m.manager_a,
                    winner: isA ? m.manager_a : m.manager_b,
                    losePoints: isA ? m.points_b : m.points_a,
                    winPoints: isA ? m.points_a : m.points_b
                };
            }).sort((a, b) => b.losePoints - a.losePoints);

            const unluckiest = losers[0];
            if (unluckiest && unluckiest.losePoints > (recap.lowestScorer?.points || 0) + 15) {
                lines.push(`💔 *O Injustiçado da Rodada:* *${unluckiest.loser}* anotou excelentes **${unluckiest.losePoints} pts**, mas cruzou logo com *${unluckiest.winner}* (${unluckiest.winPoints} pts). Teria vencido quase todo mundo, mas o azar foi astronômico!`);
            }
        }

        // 5. Standings e Power Rankings
        const standings = query(`
            SELECT 
                COALESCE(u.display_name, 'Time ' || r.roster_id) as manager,
                r.wins, r.losses, r.ties,
                ROUND(r.fpts + (COALESCE(r.fpts_decimal, 0) * 0.01), 1) as total_fpts
            FROM rosters r
            LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
            WHERE r.league_id = ?
            ORDER BY r.wins DESC, total_fpts DESC
        `, [leagueId]) as any[];

        if (standings.length > 0) {
            lines.push('', '🏆 *TABELA ATUALIZADA & POWER RANKING:*');
            standings.slice(0, 5).forEach((s, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🔹';
                lines.push(`${medal} *#${idx + 1} ${s.manager}*: ${s.wins}V-${s.losses}D (${s.total_fpts} pts)`);
            });
            const lanterna = standings[standings.length - 1];
            lines.push(`💀 *Lanterninha Isolado:* *${lanterna.manager}* (${lanterna.wins}V-${lanterna.losses}D) - Se continuar nessa toada, já reserva o PIX do churrasco!`);
        }

        // 6. Trash Talk Ácido Final
        lines.push(
            '',
            '🔥 *RECADO DO HERMES PROS PERDEDORES:*',
            'Parem de culpar o clima, a arbitragem e a lesão do kicker: assumam a incompetência da escalação de vocês! Quem ganhou, tem licença poética pra zoar e mandar figurinha ácida até quinta-feira; quem perdeu, chora no banho que é lugar quente!',
            '',
            '💬 _Amanhã às 08:00 soltamos o Radar do Waiver Wire: hora de ver quem tem coragem de queimar o FAAB ou vai continuar abraçado com a mediocridade!_'
        );

        return {
            slot_key: 'tue_08h_recap',
            title: 'Fechamento Oficial Ácido da Rodada',
            message_text: lines.join('\n'),
            teaser_next: 'Amanhã às 08:00 abrem os waivers: hora de ver quem tem coragem de queimar o FAAB!'
        };
    }

    // =========================================================================
    // 2. QUARTA-FEIRA 08:00 - Radar do Waiver Wire
    // =========================================================================
    generateWednesdayWaiverRadar(leagueId: string): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);

        const trendingAdds = query(`
            SELECT p.player_id, p.full_name, p.position, p.team, t.count
            FROM trending_players t
            JOIN players p ON t.player_id = p.player_id
            WHERE t.trend_type = 'add'
            ORDER BY t.count DESC
            LIMIT 15
        `) as any[];

        const rosterPlayers = query(`SELECT players FROM rosters WHERE league_id = ?`, [leagueId]) as any[];
        const ownedSet = new Set<string>();
        for (const rp of rosterPlayers) {
            if (rp.players) {
                const list = JSON.parse(rp.players) || [];
                list.forEach((id: string) => ownedSet.add(id));
            }
        }

        const availableTrending = trendingAdds.filter(p => !ownedSet.has(p.player_id)).slice(0, 5);

        const lines: string[] = [
            `🎯 *RADAR DO WAIVER WIRE: ${league.name.toUpperCase()}* 🎯`,
            `💡 *Os Alvos Mais Quentes Disponíveis para a Madrugada de 4ª para 5ª:*`,
            ''
        ];

        if (availableTrending.length > 0) {
            availableTrending.forEach((p, idx) => {
                lines.push(`🔥 *#${idx + 1} ${p.full_name}* (${p.position} - ${p.team || 'FA'}) ➡️ +${p.count} adições na NFL.`);
            });
        } else {
            lines.push('ℹ️ _Os principais nomes de waiver já foram garimpados na liga! Olho nos reservas imediatos._');
        }

        const teaser = 'Amanhã às 08h começa a nossa MARATONA DE PRÉ-RODADA de hora em hora com o relatório de quem torrou o FAAB!';
        lines.push('', `💰 _${teaser}_`);

        return {
            slot_key: 'wed_08h_waiver_radar',
            title: 'Radar do Waiver Wire (Alvos Cobiçados)',
            message_text: lines.join('\n'),
            teaser_next: teaser
        };
    }

    // =========================================================================
    // 3. DIA DO PRIMEIRO JOGO (Geralmente Quinta) - MARATONA DE PRÉ-RODADA
    // =========================================================================

    /**
     * Bloco 1 (08:00): Plantão do Waiver Wire (Madrugada de 4ª para 5ª)
     */
    generateOpeningDay08hWaivers(leagueId: string, week: number): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const firstDay = this.getFirstGameDay(league.season, week);

        const waivers = query(`
            SELECT 
                t.transaction_id,
                t.type,
                t.adds,
                t.drops,
                t.settings,
                COALESCE(u.display_name, 'Manager') as manager
            FROM transactions t
            LEFT JOIN sleeper_users u ON t.creator_id = u.user_id
            WHERE t.league_id = ? AND t.type IN ('waiver', 'free_agent') AND t.status = 'complete'
            ORDER BY t.created_at DESC
            LIMIT 15
        `, [leagueId]) as any[];

        const lines: string[] = [
            `💰 *PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) - BLOCO 1 (08:00)* 💰`,
            `📋 *Plantão do Waiver Wire & O Primeiro Jogo da Rodada é HOJE!*`,
            `🏆 Liga: *${league.name}* (Semana ${week})`,
            `🏈 *Kickoff da Semana: ${firstDay.dayName} (${firstDay.dateStr})*`,
            ''
        ];

        if (waivers.length > 0) {
            lines.push('💸 *Reivindicações Processadas na Madrugada:*');
            for (const w of waivers.slice(0, 5)) {
                const settings = (w.settings ? (typeof w.settings === 'string' ? JSON.parse(w.settings) : w.settings) : null) || {};
                const bid = settings?.waiver_bid ? `$${settings.waiver_bid} FAAB` : 'Free Agent ($0)';
                const addsObj = (w.adds ? (typeof w.adds === 'string' ? JSON.parse(w.adds) : w.adds) : null) || {};
                const playerIds = Object.keys(addsObj);

                if (playerIds.length > 0) {
                    const p = queryOne('SELECT full_name, position, team FROM players WHERE player_id = ?', [playerIds[0]]) as any;
                    const pName = p ? `${p.full_name} (${p.position} - ${p.team || 'FA'})` : `Player ${playerIds[0]}`;
                    lines.push(`✅ *${w.manager}* levou **${pName}** por *${bid}*`);
                }
            }
        } else {
            lines.push('ℹ️ _Nenhum waiver milionário nesta madrugada. Managers economizando ou dormindo no ponto!_');
        }

        const teaser = 'Às 09:00 soltamos a Análise da Tabela e o Termômetro de Classificação da nossa liga!';
        lines.push('', `⏳ _${teaser}_`);

        return {
            slot_key: 'opening_08h_waivers',
            title: `Pré-Rodada (${firstDay.dayName}) 08h - Plantão do Waiver Wire`,
            message_text: lines.join('\n'),
            teaser_next: teaser
        };
    }

    /**
     * Bloco 2 (09:00): Termômetro da Liga & Disputa de Classificação
     */
    generateOpeningDay09hStandings(leagueId: string, week: number): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const firstDay = this.getFirstGameDay(league.season, week);

        const standings = query(`
            SELECT 
                COALESCE(u.display_name, 'Time ' || r.roster_id) as manager,
                r.wins, r.losses, r.ties,
                ROUND(r.fpts + (COALESCE(r.fpts_decimal, 0) * 0.01), 1) as total_fpts
            FROM rosters r
            LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
            WHERE r.league_id = ?
            ORDER BY r.wins DESC, total_fpts DESC
        `, [leagueId]) as any[];

        const lines: string[] = [
            `📊 *PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) - BLOCO 2 (09:00)* 📊`,
            `📋 *Termômetro da Liga & Cenário de Disputa*`,
            `🏆 Liga: *${league.name}* (Semana ${week})`,
            ''
        ];

        if (week <= 4) {
            lines.push('🌱 *Início de Temporada (Fase de Afirmação):*');
            lines.push('Ninguém é campeão na semana 1 ou 2, mas já dá pra ver quem montou uma seleção e quem montou um asilo.');
        } else if (week <= 10) {
            lines.push('🔥 *Meio de Temporada (O Funil Começa a Apertar):*');
            lines.push('A zona de playoffs está embolada. Uma derrota agora pode custar a vaga em dezembro.');
        } else if (week <= 14) {
            lines.push('🚨 *Reta Final de Temporada Regular (Vida ou Morte):*');
            lines.push('Calculadoras ligadas! Cada ponto decimal conta para os playoffs ou para escapar da humilhação da lanterna!');
        } else {
            lines.push('👑 *MATA-MATA DOS PLAYOFFS:*');
            lines.push('Não tem amanhã! Perdeu, tá fora. Venceu, tá na história.');
        }

        if (standings.length > 0) {
            const leader = standings[0];
            const lanterna = standings[standings.length - 1];
            lines.push(
                '',
                `🥇 *No Topo da Montanha:* **${leader.manager}** (${leader.wins}V-${leader.losses}D)`,
                `🥔 *No Fundo do Poço:* **${lanterna.manager}** (${lanterna.wins}V-${lanterna.losses}D) - Precisa de um milagre nesta semana!`
            );
        }

        const teaser = 'Às 10:00 chega o Card de Confrontos da Semana e as Rivalidades Históricas (H2H)!';
        lines.push('', `⏳ _${teaser}_`);

        return {
            slot_key: 'opening_09h_standings',
            title: `Pré-Rodada (${firstDay.dayName}) 09h - Termômetro da Liga`,
            message_text: lines.join('\n'),
            teaser_next: teaser
        };
    }

    /**
     * Bloco 3 (10:00): Card de Confrontos & Rivalidades Históricas (H2H)
     */
    generateOpeningDay10hMatchups(leagueId: string, week: number): ScheduledMessageResult {
        const { league, family } = this.getLeagueContext(leagueId);
        const firstDay = this.getFirstGameDay(league.season, week);

        const matchups = query(`
            SELECT 
                m1.matchup_id,
                COALESCE(u1.display_name, 'Time ' || m1.roster_id) as manager_a,
                COALESCE(u2.display_name, 'Time ' || m2.roster_id) as manager_b
            FROM matchups m1
            JOIN matchups m2 ON m1.league_id = m2.league_id 
                AND m1.week = m2.week 
                AND m1.matchup_id = m2.matchup_id 
                AND m1.roster_id < m2.roster_id
            JOIN rosters r1 ON m1.league_id = r1.league_id AND m1.roster_id = r1.roster_id
            LEFT JOIN sleeper_users u1 ON r1.owner_id = u1.user_id
            JOIN rosters r2 ON m2.league_id = r2.league_id AND m2.roster_id = r2.roster_id
            LEFT JOIN sleeper_users u2 ON r2.owner_id = u2.user_id
            WHERE m1.league_id = ? AND m1.week = ?
        `, [leagueId, week]) as any[];

        const h2hMatrix = family ? leagueAnalytics.getH2HMatrix(family) : [];

        const lines: string[] = [
            `⚔️ *PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) - BLOCO 3 (10:00)* ⚔️`,
            `📋 *Card de Confrontos da Semana & Rivalidades Históricas (H2H)*`,
            `🏆 Liga: *${league.name}* (Semana ${week})`,
            ''
        ];

        for (const m of matchups) {
            const h2h = h2hMatrix.find(r =>
                (r.manager_a.toLowerCase() === m.manager_a.toLowerCase() && r.manager_b.toLowerCase() === m.manager_b.toLowerCase()) ||
                (r.manager_a.toLowerCase() === m.manager_b.toLowerCase() && r.manager_b.toLowerCase() === m.manager_a.toLowerCase())
            );

            const h2hNote = h2h
                ? ` [Histórico: ${h2h.manager_a} ${h2h.wins_a} x ${h2h.wins_b} ${h2h.manager_b}]`
                : ' [Primeiro Duelo Histórico]';

            lines.push(`🥊 *${m.manager_a}* VS *${m.manager_b}*${h2hNote}`);
        }

        const teaser = 'Às 11:00 tem o Boletim Médico & Dúvidas dos Titulares!';
        lines.push('', `⏳ _${teaser}_`);

        return {
            slot_key: 'opening_10h_matchups',
            title: `Pré-Rodada (${firstDay.dayName}) 10h - Card de Confrontos & H2H`,
            message_text: lines.join('\n'),
            teaser_next: teaser
        };
    }

    /**
     * Bloco 4 (11:00): Boletim Médico & Dúvidas dos Titulares
     */
    generateOpeningDay11hInjuries(leagueId: string, week: number = 1): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const firstDay = this.getFirstGameDay(league.season, week);
        const news = newsScraper.getLatestNews(10, 'injury');

        const lines: string[] = [
            `🏥 *PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) - BLOCO 4 (11:00)* 🏥`,
            `📋 *Boletim Médico & Dúvidas dos Titulares*`,
            `🏆 Liga: *${league.name}*`,
            ''
        ];

        if (news.length > 0) {
            news.slice(0, 4).forEach(n => {
                lines.push(`🚨 **${n.title}**`);
                lines.push(`   _${n.summary.slice(0, 110)}..._\n`);
            });
        } else {
            lines.push('✅ _Nenhum desfalque grave reportado nas últimas horas._');
        }

        lines.push(`⚠️ *Dica de Ouro do Hermes:* Não escalem jogadores de hoje (${firstDay.dayName}) no FLEX! Usem as vagas de WR/RB/TE primárias para manter opções abertas no domingão!`);

        const teaser = 'Fechando a maratona de abertura, às 12:00: Sessão de Trash Talk e Previsões do Hermes!';
        lines.push('', `⏳ _${teaser}_`);

        return {
            slot_key: 'opening_11h_injuries',
            title: `Pré-Rodada (${firstDay.dayName}) 11h - Boletim Médico`,
            message_text: lines.join('\n'),
            teaser_next: teaser
        };
    }

    /**
     * Bloco 5 (12:00): Trash Talk & Palpites Ousados
     */
    generateOpeningDay12hTrashTalk(leagueId: string, week: number): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const firstDay = this.getFirstGameDay(league.season, week);

        const lines: string[] = [
            `🍿 *PRÉ-RODADA (${firstDay.dayName.toUpperCase()}) - BLOCO 5 (12:00)* 🍿`,
            `📋 *Palpites do Hermes & Sessão de Trash Talk da Abertura*`,
            `🏆 Liga: *${league.name}* (Semana ${week})`,
            '',
            '🤖 *As Leis Imutáveis do Fantasy para Hoje:*',
            `• Aquele jogador que você escalou hoje (${firstDay.dayName}) vai decepcionar e você vai passar o fim de semana inteiro reclamando no grupo.`,
            '• O seu rival vai ter um kicker que vai acertar três field goals de 50+ jardas no domingão.',
            '• Quem falar grosso no grupo antes dos jogos é quem mais vai passar vergonha no fechamento!',
            '',
            '🔥 _Façam suas apostas, convoquem os santos e que comece a rodada!_',
            `📱 _Hoje à noite (${firstDay.dayName}) às ${firstDay.timeStr} (Horário de Brasília) tem bola voando! Assim que terminar o jogo, soltaremos a primeira parcial ao vivo no grupo!_`
        ];

        return {
            slot_key: 'opening_12h_trashtalk',
            title: `Pré-Rodada (${firstDay.dayName}) 12h - Trash Talk & Palpites`,
            message_text: lines.join('\n')
        };
    }

    // =========================================================================
    // 4. DOMINGO PELA MANHÃ - MARATONA DE ATUALIZAÇÃO DA PRÉ-RODADA
    // =========================================================================

    /**
     * Domingo 08:00 - Rescaldo dos Jogos Já Disputados + Waivers de Sábado p/ Domingo
     */
    generateSunday08hWaiversAndRecap(leagueId: string, week: number): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const nflSeason = this.resolveNflSeason(league.season, week);

        // Waivers processed in the weekend (Sat -> Sun morning)
        const waivers = query(`
            SELECT 
                t.transaction_id,
                t.type,
                t.adds,
                t.drops,
                t.settings,
                t.created_at,
                COALESCE(u.display_name, 'Manager') as manager
            FROM transactions t
            LEFT JOIN sleeper_users u ON t.creator_id = u.user_id
            WHERE t.league_id = ? AND t.type IN ('waiver', 'free_agent') AND t.status = 'complete'
            ORDER BY t.created_at DESC
            LIMIT 10
        `, [leagueId]) as any[];

        // Top scorers in games already completed this week (e.g. Thursday or Friday)
        const topScorers = nflCollector.getWeeklyTopPerformers(nflSeason, week, 3);

        const lines: string[] = [
            `☀️ *DOMINGO DE FANTASY FOOTBALL - BLOCO 1 (08:00)* 🏈`,
            `📋 *Waivers de Sábado p/ Domingo & Rescaldo dos Jogos Já Disputados*`,
            `🏆 Liga: *${league.name}* (Semana ${week})`,
            '',
            '📋 *1. Plantão do Waiver Wire (Madrugada de Sábado para Domingo):*'
        ];

        if (waivers.length > 0) {
            for (const w of waivers.slice(0, 4)) {
                const settings = (w.settings ? (typeof w.settings === 'string' ? JSON.parse(w.settings) : w.settings) : null) || {};
                const bid = settings?.waiver_bid ? `$${settings.waiver_bid} FAAB` : 'Free Agent ($0)';
                const addsObj = (w.adds ? (typeof w.adds === 'string' ? JSON.parse(w.adds) : w.adds) : null) || {};
                const playerIds = Object.keys(addsObj);
                if (playerIds.length > 0) {
                    const p = queryOne('SELECT full_name, position, team FROM players WHERE player_id = ?', [playerIds[0]]) as any;
                    const pName = p ? `${p.full_name} (${p.position} - ${p.team || 'FA'})` : `Player ${playerIds[0]}`;
                    lines.push(`• *${w.manager}* garantiu **${pName}** por *${bid}*`);
                }
            }
        } else {
            lines.push('• _Nenhum waiver de última hora registrado nesta madrugada._');
        }

        if (topScorers.length > 0) {
            lines.push('', '🌟 *2. Destaques dos Jogos Anteriores da Semana:*');
            topScorers.forEach(p => {
                const statStr = this.formatPlayerDetailedStats(p);
                lines.push(`• *${p.full_name}* (${p.position}-${p.team}): **${p.pts_ppr} pts** ${statStr}`);
            });
        }

        const sundayTimes = this.getSundayScheduleTimes(league.season, week);
        const teaser = `Às ${sundayTimes.matchupsUpdateTimeBRT} vem o Card de Confrontos ATUALIZADO com as parciais dos jogos já realizados!`;
        lines.push('', `⏳ _${teaser}_`);

        return {
            slot_key: 'sun_08h_waivers_recap',
            title: `Domingo ${sundayTimes.waiversRecapTimeBRT} - Rescaldo & Waivers do Fim de Semana`,
            message_text: lines.join('\n'),
            teaser_next: teaser
        };
    }

    /**
     * Domingo 09:00 (ou adaptado) - Card de Confrontos Atualizado com Parciais
     */
    generateSunday09hMatchupCardUpdate(leagueId: string, week: number): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const sundayTimes = this.getSundayScheduleTimes(league.season, week);

        const matchups = query(`
            SELECT 
                m1.matchup_id,
                COALESCE(u1.display_name, 'Time ' || m1.roster_id) as manager_a,
                COALESCE(m1.points, 0) as points_a,
                COALESCE(u2.display_name, 'Time ' || m2.roster_id) as manager_b,
                COALESCE(m2.points, 0) as points_b
            FROM matchups m1
            JOIN matchups m2 ON m1.league_id = m2.league_id 
                AND m1.week = m2.week 
                AND m1.matchup_id = m2.matchup_id 
                AND m1.roster_id < m2.roster_id
            JOIN rosters r1 ON m1.league_id = r1.league_id AND m1.roster_id = r1.roster_id
            LEFT JOIN sleeper_users u1 ON r1.owner_id = u1.user_id
            JOIN rosters r2 ON m2.league_id = r2.league_id AND m2.roster_id = r2.roster_id
            LEFT JOIN sleeper_users u2 ON r2.owner_id = u2.user_id
            WHERE m1.league_id = ? AND m1.week = ?
        `, [leagueId, week]) as any[];

        const lines: string[] = [
            `⚔️ *DOMINGO DE FANTASY FOOTBALL - BLOCO 2 (${sundayTimes.matchupsUpdateTimeBRT})* ⚔️`,
            `📋 *Card de Confrontos Atualizado com Parciais dos Jogos Anteriores*`,
            `🏆 Liga: *${league.name}* (Semana ${week})`,
            ''
        ];

        for (const m of matchups) {
            const hasPoints = m.points_a > 0 || m.points_b > 0;
            let scoreStr = ` (0 x 0 - Começa hoje às ${sundayTimes.kickoffTimeBRT}!)`;
            if (hasPoints) {
                const diff = Math.round(Math.abs(m.points_a - m.points_b) * 10) / 10;
                const leader = m.points_a > m.points_b ? m.manager_a : m.points_b > m.points_a ? m.manager_b : 'Empate';
                scoreStr = ` (Parcial: ${m.points_a} x ${m.points_b} ➡️ *${leader}* lidera por +${diff} pts)`;
            }
            lines.push(`🥊 *${m.manager_a}* VS *${m.manager_b}*${scoreStr}`);
        }

        const teaser = `Às ${sundayTimes.injuriesTimeBRT} soltamos o Boletim Médico Dominical com as últimas notícias de quem joga hoje!`;
        lines.push('', `⏳ _${teaser}_`);

        return {
            slot_key: 'sun_09h_matchups_update',
            title: `Domingo ${sundayTimes.matchupsUpdateTimeBRT} - Card de Duelos Atualizado`,
            message_text: lines.join('\n'),
            teaser_next: teaser
        };
    }

    /**
     * Domingo 10:00 - Boletim Médico Dominical
     */
    generateSunday10hInjuries(leagueId: string, week: number = 1): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const news = newsScraper.getLatestNews(10, 'injury');
        const sundayTimes = this.getSundayScheduleTimes(league.season, week);

        const lines: string[] = [
            `🏥 *BOLETIM MÉDICO DOMINICAL (ÚLTIMAS NOTÍCIAS)* 🏥`,
            `🏆 Liga: *${league.name}*`,
            ''
        ];

        if (news.length > 0) {
            news.slice(0, 4).forEach(n => {
                lines.push(`🚨 **${n.title}**`);
                lines.push(`   _${n.summary.slice(0, 110)}..._\n`);
            });
        } else {
            lines.push('✅ _Sem surpresas médicas nas últimas horas. Fiquem ligados na lista oficial de inativos!_');
        }

        const teaser = `Às ${sundayTimes.trashTalkTimeBRT} tem o Trash Talk do Domingo e às ${sundayTimes.inactivesAlertTimeBRT} o Alerta Vermelho de Inativos!`;
        lines.push('', `⏳ _${teaser}_`);

        return {
            slot_key: 'sun_10h_injuries',
            title: `Domingo ${sundayTimes.injuriesTimeBRT} - Boletim Médico Dominical`,
            message_text: lines.join('\n'),
            teaser_next: teaser
        };
    }

    /**
     * Domingo (Horário Dinâmico: 120 min antes do Kickoff) - Trash Talk Pré-Kickoff do Domingo
     */
    generateSunday11hTrashTalk(leagueId: string, week: number = 1): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const sundayTimes = this.getSundayScheduleTimes(league.season, week);

        const lines: string[] = [
            `🔥 *AQUECIMENTO PRÉ-KICKOFF & TRASH TALK DO DOMINGO* 🔥`,
            `🏆 Liga: *${league.name}* (Semana ${week})`,
            '',
            `Falta pouco para a rodada das ${sundayTimes.kickoffTimeBRT} (Horário de Brasília) pegar fogo!`,
            '• É dia de passar raiva no RedZone.',
            '• É dia de ver o running back reserva do time rival roubar o touchdown na linha de 1 jarda.',
            '• É dia de amassar ou ser amassado!',
            '',
            `⏰ _Daqui a 30 minutos (às ${sundayTimes.inactivesAlertTimeBRT}, exatos 90 minutos antes do kickoff), soltaremos o Alerta Vermelho de Inativos com as listas oficiais dos times!_`
        ];

        return {
            slot_key: 'sun_11h_trashtalk',
            title: `Domingo ${sundayTimes.trashTalkTimeBRT} - Trash Talk Pré-Kickoff`,
            message_text: lines.join('\n')
        };
    }

    /**
     * Domingo (Horário Dinâmico: EXATOS 90 MINUTOS antes do 1º Kickoff) - Alerta Vermelho de Inativos
     */
    generateSundayInactivesAlert(leagueId: string, week: number = 1): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const sundayTimes = this.getSundayScheduleTimes(league.season, week);

        const rosters = query(`
            SELECT 
                r.roster_id,
                r.starters,
                COALESCE(u.display_name, 'Time ' || r.roster_id) as manager
            FROM rosters r
            LEFT JOIN sleeper_users u ON r.owner_id = u.user_id
            WHERE r.league_id = ?
        `, [leagueId]) as any[];

        const warnings: string[] = [];

        for (const r of rosters) {
            if (!r.starters) continue;
            const starterIds: string[] = (typeof r.starters === 'string' ? JSON.parse(r.starters) : r.starters) || [];

            for (const pid of starterIds) {
                if (!pid || pid === '0') continue;
                const p = queryOne(`
                    SELECT full_name, injury_status, team 
                    FROM players 
                    WHERE player_id = ? AND injury_status IN ('Out', 'IR', 'Doubtful', 'PUP', 'Suspended')
                `, [pid]) as any;

                if (p) {
                    warnings.push(`⚠️ *@${r.manager}*: **${p.full_name}** (${p.team}) está como titular mas consta como **${p.injury_status.toUpperCase()}**! Troque antes das ${sundayTimes.kickoffTimeBRT}!`);
                }
            }
        }

        const lines: string[] = [
            `🚨 *ALERTA VERMELHO DE INATIVOS (90 MINUTOS PRO KICKOFF)* 🚨`,
            `🏆 Liga: *${league.name}*`,
            `⏰ *O primeiro jogo de hoje começa às ${sundayTimes.kickoffTimeBRT} (Horário de Brasília)!*`,
            `⚠️ *Managers com titulares confirmados fora têm até às ${sundayTimes.kickoffTimeBRT} para fazer alterações!*`,
            ''
        ];

        if (warnings.length > 0) {
            lines.push('⚠️ *ATENÇÃO MANAGERS: TITULARES CONFIRMADOS FORA NA ESCALAÇÃO!*', ...warnings);
        } else {
            lines.push('✅ *Tudo em ordem!* Nenhum titular confirmado como OUT/IR/Doubtful detectado nas escalações da liga. Boa sorte a todos!');
        }

        return {
            slot_key: 'sun_11h30_inactives',
            title: `Domingo ${sundayTimes.inactivesAlertTimeBRT} - Alerta de Inativos (Kickoff ${sundayTimes.kickoffTimeBRT})`,
            message_text: lines.join('\n')
        };
    }

    // =========================================================================
    // 5. SEGUNDA-FEIRA 08:00 - Decididos vs Dramas do MNF
    // =========================================================================
    generateMondayDecisions(leagueId: string, week: number): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);
        const mnf = this.getMnfGameTime(league.season, week);

        const matchups = query(`
            SELECT 
                m1.matchup_id,
                COALESCE(u1.display_name, 'Time ' || m1.roster_id) as manager_a,
                m1.points as points_a,
                COALESCE(u2.display_name, 'Time ' || m2.roster_id) as manager_b,
                m2.points as points_b,
                ROUND(ABS(m1.points - m2.points), 2) as margin,
                CASE WHEN m1.points > m2.points THEN u1.display_name ELSE u2.display_name END as leader
            FROM matchups m1
            JOIN matchups m2 ON m1.league_id = m2.league_id 
                AND m1.week = m2.week 
                AND m1.matchup_id = m2.matchup_id 
                AND m1.roster_id < m2.roster_id
            JOIN rosters r1 ON m1.league_id = r1.league_id AND m1.roster_id = r1.roster_id
            LEFT JOIN sleeper_users u1 ON r1.owner_id = u1.user_id
            JOIN rosters r2 ON m2.league_id = r2.league_id AND m2.roster_id = r2.roster_id
            LEFT JOIN sleeper_users u2 ON r2.owner_id = u2.user_id
            WHERE m1.league_id = ? AND m1.week = ?
            ORDER BY margin ASC
        `, [leagueId, week]) as any[];

        const lines: string[] = [
            `⚖️ *SEGUNDA DECISIVA: O QUE FALTA PRO MONDAY NIGHT FOOTBALL* ⚖️`,
            `🏆 Liga: *${league.name}* (Semana ${week})`,
            ''
        ];

        const closeGames = matchups.filter(m => m.margin < 25);
        const settledGames = matchups.filter(m => m.margin >= 25);

        if (closeGames.length > 0) {
            lines.push('🔥 *DRAMAS EM ABERTO NO MNF:*');
            for (const g of closeGames) {
                lines.push(`• *${g.manager_a}* (${g.points_a}) vs (${g.points_b}) *${g.manager_b}* (Diferença: **${g.margin} pts**)`);
            }
            lines.push('');
        }

        if (settledGames.length > 0) {
            lines.push('✅ *Praticamente Decididos:*');
            for (const s of settledGames) {
                lines.push(`• *${s.leader}* com vitória encaminhada (+${s.margin} pts)`);
            }
        }

        const mnfNote = mnf.hasMnf
            ? `📺 _Hoje às ${mnf.timeBRT} (Horário de Brasília) tem o Monday Night Football${mnf.gameStr ? ` (${mnf.gameStr})` : ''}!_`
            : '📺 _Preparem o coração para a decisão de hoje à noite!_';

        lines.push('', mnfNote);

        return {
            slot_key: 'mon_08h_decisions',
            title: 'Segunda 08h - Decisões do MNF',
            message_text: lines.join('\n')
        };
    }

    // =========================================================================
    // 6. GATILHO INTELIGENTE: Parcial Imediata ao Apito Final
    // =========================================================================
    generateGameFinalFlash(leagueId: string, game: any, week: number): ScheduledMessageResult {
        const { league } = this.getLeagueContext(leagueId);

        const lines: string[] = [
            `⚡ *APITO FINAL NA NFL: PARCIAL DA RODADA!* ⚡`,
            `🏟️ **${game.away_team}** ${game.away_score} x ${game.home_score} **${game.home_team}** (Final)`,
            `🏆 Liga: *${league.name}*`,
            ''
        ];

        if (game.leaders) {
            const leaders = typeof game.leaders === 'string' ? JSON.parse(game.leaders) : game.leaders;
            const highlights = Object.entries(leaders)
                .map(([cat, lead]: any) => `• ${cat}: *${lead.displayName}* (${lead.value})`)
                .slice(0, 3);
            if (highlights.length > 0) {
                lines.push('🌟 *Destaques da Partida:*', ...highlights, '');
            }
        }

        lines.push('📱 _Amanhã às 08:00 soltaremos o balanço completo com o impacto nos confrontos da nossa liga!_');

        return {
            slot_key: `game_final_${game.game_id}`,
            title: `Parcial Relâmpago: ${game.away_team} @ ${game.home_team}`,
            message_text: lines.join('\n')
        };
    }
}

export const weeklySchedule = new WeeklyScheduleService();
