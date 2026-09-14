import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { leagueAnalytics, LeagueFamily } from './league-analytics.service.js';
import { nflCollector } from './nfl-collector.service.js';
import { newsScraper } from './news-scraper.service.js';
import { query, queryOne } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const KB_DIR = path.join(ROOT_DIR, 'knowledge_base');

export class KnowledgeBaseGeneratorService {
    private ensureDir(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    private writeFile(filePath: string, content: string): void {
        this.ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, content.trim() + '\n', 'utf-8');
    }

    /**
     * Generate complete Knowledge Base
     */
    async generateAll(): Promise<{ leaguesCount: number; filesCount: number }> {
        console.log('📚 Initializing Knowledge Base Generation...');
        this.ensureDir(KB_DIR);

        let filesCount = 0;

        // 1. Generate NFL Context
        filesCount += await this.generateNFLSection();

        // 2. Generate Leagues Section
        const families = leagueAnalytics.getLeagueFamilies();
        console.log(`🏈 Found ${families.length} league families across all seasons.`);

        for (const fam of families) {
            filesCount += this.generateLeagueFamilyKB(fam);
        }

        // 3. Generate Agent Prompts & Config
        filesCount += this.generateAgentSection();

        // 4. Generate Main Index README
        this.generateMainIndex(families);
        filesCount++;

        console.log(`🎉 Knowledge Base generation complete! ${filesCount} files created/updated in ${KB_DIR}`);
        return { leaguesCount: families.length, filesCount };
    }

    /**
     * Main Index README
     */
    private generateMainIndex(families: LeagueFamily[]): void {
        const md = [
            '# 🏈 Sleeper Fantasy Football - Base de Conhecimento do Agente Hermes',
            '',
            'Esta base de conhecimento foi gerada automaticamente para alimentar o **Bot de IA para WhatsApp**.',
            'O agente Hermes utiliza estes documentos e consultas SQL para atuar como o comentarista oficial das ligas.',
            '',
            '## 📂 Estrutura de Diretórios',
            '',
            '- **`leagues/`**: Dossiês completos de cada liga, históricos multi-temporadas, rivalidades e recordes.',
            '- **`nfl/`**: Placares reais da NFL (ESPN), melhores desempenhos, boletim médico e notícias.',
            '- **`agent/`**: Instruções de persona, regras de conduta para o WhatsApp e ferramentas.',
            '',
            '## 🏆 Ligas Mapeadas no Sistema',
            '',
            '| Liga | Temporadas | Slugs de Acesso |',
            '|---|---|---|'
        ];

        for (const f of families) {
            const seasonsList = f.seasons.map(s => s.season).sort().join(', ');
            md.push(`| **${f.name}** | ${seasonsList} | [\`${f.slug}\`](./leagues/${f.slug}/LEAGUE_DOSSIER.md) |`);
        }

        md.push(
            '',
            '## 💡 Como o Agente Hermes Deve Operar no WhatsApp',
            '',
            '1. **Resumos Pós-Rodada (Terça-feira)**: Ler `week_{N}.md` da liga e comparar com os recordes históricos (`ALL_TIME_RECORDS.md`).',
            '2. **Plantão de Waivers (Quarta-feira)**: Comentar as escolhas mais caras de FAAB e zoar quem dropou titulares.',
            '3. **Veredito de Trocas**: Consultar `TRADE_HISTORY.md` e avaliar quem levou a melhor na negociação.',
            '4. **Confrontos Diretos (Sexta-feira)**: Consultar `H2H_RIVALRIES.md` antes dos jogos para esquentar a rivalidade no grupo.',
            '5. **Plantão Médico de Domingo**: Verificar `injuries_and_status.md` antes do kickoff.'
        );

        this.writeFile(path.join(KB_DIR, 'README.md'), md.join('\n'));
    }

    /**
     * Generate NFL Section
     */
    private async generateNFLSection(): Promise<number> {
        console.log('   📄 Generating NFL section...');
        let files = 0;
        const nflDir = path.join(KB_DIR, 'nfl');

        // 1. Current State
        const nflState = queryOne('SELECT * FROM nfl_state WHERE id = 1') as any;
        const currentSeason = nflState?.season || '2024';
        const currentWeek = nflState?.week || 1;

        const stateMd = [
            '# 🏈 Estado Atual da NFL & Fantasy',
            '',
            `- **Temporada**: ${currentSeason} (${nflState?.season_type || 'regular'})`,
            `- **Semana Atual**: Semana ${currentWeek}`,
            `- **Semana de Exibição**: Semana ${nflState?.display_week || currentWeek}`,
            `- **Última Atualização**: ${new Date().toLocaleString('pt-BR')}`,
            '',
            'Este documento indica o momento temporal em que a liga se encontra para comentários em tempo real.'
        ];
        this.writeFile(path.join(nflDir, 'current_week.md'), stateMd.join('\n'));
        files++;

        // 2. Scoreboard
        const games = nflCollector.getWeeklyGames(currentSeason, currentWeek);
        const scoreMd = [
            `# 🏟️ Placares da NFL - Semana ${currentWeek} (${currentSeason})`,
            '',
            games.length > 0
                ? '| Jogo | Placar | Status | Detalhes & Líderes |'
                : '_Nenhum jogo registrado para esta semana ainda._',
            games.length > 0 ? '|---|---|---|---|' : ''
        ];

        for (const g of games) {
            const leadersStr = g.leaders
                ? Object.entries(g.leaders as any)
                    .map(([cat, lead]: any) => `**${cat}**: ${lead.displayName} (${lead.team}) ${lead.value}`)
                    .join('<br>')
                : '-';
            scoreMd.push(`| **${g.away_team}** @ **${g.home_team}** | ${g.away_score} - ${g.home_score} | ${g.status_detail || g.status} | ${leadersStr} |`);
        }
        this.writeFile(path.join(nflDir, 'games_scoreboard.md'), scoreMd.join('\n'));
        files++;

        // 3. Top Performers
        const topPerformers = nflCollector.getWeeklyTopPerformers(currentSeason, currentWeek, 25);
        const topMd = [
            `# 🌟 Maiores Pontuadores da NFL - Semana ${currentWeek} (${currentSeason})`,
            '',
            topPerformers.length > 0
                ? '| Jogador | Posição | Time | Pontos PPR | Pontos Half-PPR |'
                : '_Estatísticas da semana em processamento._',
            topPerformers.length > 0 ? '|---|---|---|---|---|' : ''
        ];

        for (const p of topPerformers) {
            topMd.push(`| **${p.full_name}** | ${p.position || 'FLEX'} | ${p.team || 'FA'} | **${p.pts_ppr}** | ${p.pts_half_ppr} |`);
        }
        this.writeFile(path.join(nflDir, 'top_performers.md'), topMd.join('\n'));
        files++;

        // 4. Injuries and News
        const news = newsScraper.getLatestNews(30);
        const newsMd = [
            '# 🏥 Boletim Médico & Notícias de Fantasy Football',
            '',
            `_Atualizado em: ${new Date().toLocaleString('pt-BR')}_`,
            '',
            news.length > 0
                ? '| Categoria | Notícia | Fonte | Data |'
                : '_Nenhuma notícia coletada no momento._',
            news.length > 0 ? '|---|---|---|---|' : ''
        ];

        for (const n of news) {
            const catEmoji = n.category === 'injury' ? '🚨 Lesão' : n.category === 'waiver' ? '⚡ Waiver' : n.category === 'trade' ? '🔄 Troca' : '📰 Análise';
            const cleanTitle = n.title.replace(/\|/g, '-');
            newsMd.push(`| ${catEmoji} | [**${cleanTitle}**](${n.link})<br>${n.summary.slice(0, 150)}... | ${n.source} | ${new Date(n.published_at).toLocaleDateString('pt-BR')} |`);
        }
        this.writeFile(path.join(nflDir, 'injuries_and_status.md'), newsMd.join('\n'));
        files++;

        // 5. Trending Players
        const trendingAdds = query(`
            SELECT p.full_name, p.position, p.team, t.count
            FROM trending_players t
            JOIN players p ON t.player_id = p.player_id
            WHERE t.trend_type = 'add'
            ORDER BY t.count DESC LIMIT 10
        `) as any[];

        const trendingDrops = query(`
            SELECT p.full_name, p.position, p.team, t.count
            FROM trending_players t
            JOIN players p ON t.player_id = p.player_id
            WHERE t.trend_type = 'drop'
            ORDER BY t.count DESC LIMIT 10
        `) as any[];

        const trendMd = [
            '# 📈 Jogadores em Alta & Baixa no Fantasy (Últimas 24 Horas)',
            '',
            '## 🔥 Mais Adicionados no Sleeper (Trending Adds)',
            '| Jogador | Posição | Time | Adições (24h) |',
            '|---|---|---|---|'
        ];

        for (const a of trendingAdds) {
            trendMd.push(`| **${a.full_name}** | ${a.position} | ${a.team} | +${a.count} |`);
        }

        trendMd.push('', '## ❄️ Mais Dispensados no Sleeper (Trending Drops)', '| Jogador | Posição | Time | Dispensas (24h) |', '|---|---|---|---|');
        for (const d of trendingDrops) {
            trendMd.push(`| **${d.full_name}** | ${d.position} | ${d.team} | -${d.count} |`);
        }
        this.writeFile(path.join(nflDir, 'projections_and_rankings.md'), trendMd.join('\n'));
        files++;

        return files;
    }

    /**
     * Generate Knowledge Base for a League Family
     */
    private generateLeagueFamilyKB(family: LeagueFamily): number {
        console.log(`   📂 Generating KB for league: ${family.name}...`);
        let files = 0;
        const leagueDir = path.join(KB_DIR, 'leagues', family.slug);

        // 1. LEAGUE_DOSSIER.md
        const activeSeason = family.seasons[0];
        const activeLeague = queryOne('SELECT * FROM leagues WHERE league_id = ?', [activeSeason.league_id]) as any;
        const scoring = activeLeague?.scoring_settings ? JSON.parse(activeLeague.scoring_settings) : {};

        const dossierMd = [
            `# 🏆 Dossiê da Liga: ${family.name}`,
            '',
            `- **Nome Oficial**: ${family.name}`,
            `- **Temporada Ativa**: ${activeSeason.season} (Status: ${activeSeason.status})`,
            `- **Total de Times**: ${activeSeason.total_rosters}`,
            `- **Histórico de Temporadas**: ${family.seasons.map(s => s.season).sort().join(', ')}`,
            '',
            '## ⚙️ Regras Principais de Pontuação',
            '',
            `- **Passe**: ${scoring.pass_yd ? `${scoring.pass_yd} pts/jarda` : '0.04 pts/jarda'}, ${scoring.pass_td || 4} pts por Touchdown, ${scoring.pass_int || -2} pts por Interceptação`,
            `- **Corrida**: ${scoring.rush_yd ? `${scoring.rush_yd} pts/jarda` : '0.1 pts/jarda'}, ${scoring.rush_td || 6} pts por Touchdown, ${scoring.fum_lost || -2} pts por Fumble perdido`,
            `- **Recepção**: ${scoring.rec || 0} pts por Recepção (${scoring.rec === 1 ? 'PPR Completo' : scoring.rec === 0.5 ? 'Half-PPR' : 'Standard'}), ${scoring.rec_yd ? `${scoring.rec_yd} pts/jarda` : '0.1 pts/jarda'}, ${scoring.rec_td || 6} pts por Touchdown`,
            '',
            '## 📜 Histórico de Temporadas da Liga',
            '',
            '| Temporada | Status | ID Sleeper |',
            '|---|---|---|'
        ];

        for (const s of family.seasons) {
            dossierMd.push(`| **${s.season}** | ${s.status} | \`${s.league_id}\` |`);
        }

        this.writeFile(path.join(leagueDir, 'LEAGUE_DOSSIER.md'), dossierMd.join('\n'));
        files++;

        // 2. MANAGERS_AND_TEAMS.md
        const careerStats = leagueAnalytics.getManagerCareerStats(family);
        const managersMd = [
            `# 👥 Managers e Elencos: ${family.name}`,
            '',
            'Estatísticas históricas consolidadas de todos os participantes que já competiram nesta liga:',
            '',
            '| Manager | Temporadas | Vitórias | Derrotas | % Vitórias | Total Pontos | Média/Ano | Títulos | Vices | Movimentações |',
            '|---|---|---|---|---|---|---|---|---|---|'
        ];

        for (const m of careerStats) {
            const champsStr = m.championships > 0 ? `🏆 x${m.championships}` : '-';
            const runnersStr = m.runner_ups > 0 ? `🥈 x${m.runner_ups}` : '-';
            managersMd.push(`| **${m.display_name}** | ${m.seasons_played} | ${m.total_wins} | ${m.total_losses} | ${m.win_pct}% | ${m.total_fpts} | ${m.avg_fpts_per_season} | ${champsStr} | ${runnersStr} | ${m.total_moves} |`);
        }

        this.writeFile(path.join(leagueDir, 'MANAGERS_AND_TEAMS.md'), managersMd.join('\n'));
        files++;

        // 3. ALL_TIME_RECORDS.md
        const records = leagueAnalytics.getAllTimeRecords(family);
        const recordsMd = [
            `# 🏅 Recordes Históricos da Liga: ${family.name}`,
            '',
            '## 🔥 Top 10 Maiores Pontuações em Uma Rodada',
            '| # | Manager | Pontos | Temporada | Semana |',
            '|---|---|---|---|---|'
        ];

        records.highScores.forEach((r, idx) => {
            recordsMd.push(`| **#${idx + 1}** | **${r.manager}** | **${r.points}** | ${r.season} | Semana ${r.week} |`);
        });

        recordsMd.push('', '## 🥶 Top 10 Menores Pontuações (Os Piores Fiascos)', '| # | Manager | Pontos | Temporada | Semana |', '|---|---|---|---|---|');
        records.lowScores.forEach((r, idx) => {
            recordsMd.push(`| **#${idx + 1}** | **${r.manager}** | **${r.points}** | ${r.season} | Semana ${r.week} |`);
        });

        recordsMd.push('', '## 💥 Top 10 Maiores Goleadas (Blowouts)', '| # | Vencedor | Perdedor | Placar | Diferença | Temporada | Semana |', '|---|---|---|---|---|---|---|');
        records.blowouts.forEach((b, idx) => {
            recordsMd.push(`| **#${idx + 1}** | **${b.winner}** | ${b.winner === b.manager_a ? b.manager_b : b.manager_a} | ${b.points_a} x ${b.points_b} | **+${b.margin}** | ${b.season} | Semana ${b.week} |`);
        });

        this.writeFile(path.join(leagueDir, 'ALL_TIME_RECORDS.md'), recordsMd.join('\n'));
        files++;

        // 4. H2H_RIVALRIES.md
        const h2h = leagueAnalytics.getH2HMatrix(family);
        const h2hMd = [
            `# ⚔️ Matriz de Rivalidades (Head-to-Head): ${family.name}`,
            '',
            'Histórico de confronto direto acumulado de todos os jogos disputados entre os participantes:',
            '',
            '| Duelo | Jogos | Vitórias A | Vitórias B | Empates | Pontos Totais | Maior Goleada | Jogo Mais Apertado |',
            '|---|---|---|---|---|---|---|---|'
        ];

        for (const pair of h2h.slice(0, 50)) {
            const blowoutStr = pair.biggest_blowout
                ? `${pair.biggest_blowout.winner} (+${pair.biggest_blowout.margin}) [${pair.biggest_blowout.season} W${pair.biggest_blowout.week}]`
                : '-';
            const closestStr = pair.closest_match
                ? `${pair.closest_match.winner} (+${pair.closest_match.margin}) [${pair.closest_match.season} W${pair.closest_match.week}]`
                : '-';

            h2hMd.push(`| **${pair.manager_a}** vs **${pair.manager_b}** | ${pair.games_played} | **${pair.wins_a}** | **${pair.wins_b}** | ${pair.ties} | ${Math.round(pair.total_points_a)} x ${Math.round(pair.total_points_b)} | ${blowoutStr} | ${closestStr} |`);
        }

        this.writeFile(path.join(leagueDir, 'H2H_RIVALRIES.md'), h2hMd.join('\n'));
        files++;

        // 5. TRADE_HISTORY.md
        const trades = leagueAnalytics.getTradeHistory(family);
        const tradesMd = [
            `# 🔄 Histórico Completo de Trocas: ${family.name}`,
            '',
            trades.length > 0
                ? `Total de **${trades.length} trocas** registradas no histórico da liga:`
                : '_Nenhuma troca concluída encontrada no histórico._',
            ''
        ];

        for (const t of trades) {
            tradesMd.push(
                `### 🤝 Troca em ${t.date} (${t.season} - Semana ${t.week || 'Pré-temporada'})`,
                ''
            );
            for (const s of t.sides) {
                tradesMd.push(`- **${s.manager}** recebeu:`);
                if (s.received.length === 0) {
                    tradesMd.push('  - _(Nenhum ativo listado)_');
                } else {
                    for (const item of s.received) {
                        tradesMd.push(`  - ${item}`);
                    }
                }
            }
            tradesMd.push('', '---', '');
        }

        this.writeFile(path.join(leagueDir, 'TRADE_HISTORY.md'), tradesMd.join('\n'));
        files++;

        // 6. DRAFT_HISTORY.md
        const drafts = leagueAnalytics.getDraftHistory(family);
        const draftMd = [
            `# 🎯 Histórico de Drafts: ${family.name}`,
            '',
            `Total de **${drafts.length} drafts** registrados:`,
            ''
        ];

        for (const d of drafts) {
            draftMd.push(
                `## 🏈 Draft da Temporada ${d.season} (Tipo: ${d.type || 'Snake'}, Total de Picks: ${d.total_picks})`,
                '',
                '### 🥇 Escolhas da Primeira Rodada (Round 1):',
                '| Pick # | Slot | Escolhido Por | Jogador Selecionado | Posição | Time |',
                '|---|---|---|---|---|---|'
            );

            for (const p of d.round1_picks) {
                draftMd.push(`| **#${p.pick_no}** | Slot ${p.draft_slot} | **${p.picked_by}** | **${p.player_name}** | ${p.position || 'FLEX'} | ${p.team || 'FA'} |`);
            }
            draftMd.push('', '---', '');
        }

        this.writeFile(path.join(leagueDir, 'DRAFT_HISTORY.md'), draftMd.join('\n'));
        files++;

        // 7. Recent Season Weeks Recap (seasons/{season}/weeks/week_{N}.md)
        for (const s of family.seasons.slice(0, 2)) { // Latest 2 seasons
            for (let w = 1; w <= 18; w++) {
                const recap = leagueAnalytics.getWeeklyRecap(s.league_id, w);
                if (!recap || recap.matchups.length === 0) continue;

                const weekMd = [
                    `# 📊 Resumo da Semana ${w} - Temporada ${s.season} (${family.name})`,
                    '',
                    `- **Maior Pontuador da Semana**: 🌟 **${recap.topScorer?.manager || 'N/A'}** com **${recap.topScorer?.points || 0} pts**`,
                    `- **Lanterna da Semana**: 🥔 **${recap.lowestScorer?.manager || 'N/A'}** com **${recap.lowestScorer?.points || 0} pts**`,
                    `- **Movimentações na Semana**: ${recap.transactions_count} transações`,
                    '',
                    '## ⚔️ Resultados dos Confrontos (Matchups)',
                    '',
                    '| Duelo | Placar | Vencedor | Margem |',
                    '|---|---|---|---|'
                ];

                for (const m of recap.matchups) {
                    weekMd.push(`| **${m.manager_a}** vs **${m.manager_b}** | ${m.points_a} x ${m.points_b} | 🏆 **${m.winner}** | ${m.margin} pts |`);
                }

                if (recap.transactions.length > 0) {
                    weekMd.push('', '## ⚡ Movimentações & Waivers da Semana', '');
                    for (const tx of recap.transactions.slice(0, 10)) {
                        const addsObj = tx.adds ? JSON.parse(tx.adds) : null;
                        const dropsObj = tx.drops ? JSON.parse(tx.drops) : null;
                        const adds = addsObj ? Object.keys(addsObj).length : 0;
                        const drops = dropsObj ? Object.keys(dropsObj).length : 0;
                        weekMd.push(`- **${tx.manager}** (${tx.type}): +${adds} jogadores / -${drops} jogadores`);
                    }
                }

                const weekPath = path.join(leagueDir, 'seasons', s.season, 'weeks', `week_${w}.md`);
                this.writeFile(weekPath, weekMd.join('\n'));
                files++;
            }
        }

        return files;
    }

    /**
     * Generate Agent Persona & Tools Config
     */
    private generateAgentSection(): number {
        console.log('   🤖 Generating Agent Persona & Hermes Config...');
        const agentDir = path.join(KB_DIR, 'agent');
        let files = 0;

        const personaMd = [
            '# 🤖 Persona do Agente Hermes: Comentarista Oficial do WhatsApp',
            '',
            'Você é o **Comentarista Oficial** e moderador sarcástico do grupo de WhatsApp da liga de Fantasy Football.',
            '',
            '## 🎭 Traços de Personalidade',
            '1. **Brasileiro Nato e Apaixonado por Fantasy**: Usa gírias autênticas do Brasil misturadas com os jargões clássicos de fantasy (ex: *amassou*, *saco de pancadas*, *deu mole*, *dormiu no ponto*, *panela*, *roubo do ano*, *waiver de luxo*, *pipocou*, *tá pagando de louco*).',
            '2. **Analítico e Cirúrgico**: Nunca fala bobagem sem dados. Você SEMPRE consulta os fatos da base de conhecimento (pontos reais, placar, quem o cara escalou, quem ele deixou no banco estourando 30 pontos, e o histórico de confrontos diretos).',
            '3. **Zoeira Sadia & Memes**: Se alguém perdeu por 0.5 ponto, você faz questão de lembrar que o kicker dele negativou ou que ele deixou um reserva de 25 pontos no banco.',
            '4. **Memória de Elefante (Histórico da Liga)**: Você sabe exatamente quantas vezes o Fulano perdeu pro Ciclano desde 2019 e joga isso na cara com elegância e humor.',
            '5. **Formato WhatsApp**: Respostas compactas, com bullets, negrito nas partes principais, emojis bem colocados e prontas para ler na tela do celular sem virar um textão chato.',
            '',
            '## 📋 Tipos de Mensagens para o Grupo',
            '',
            '### 1. Resumo da Rodada (Terça-feira de Manhã)',
            '```text',
            '🚨 *GIRO DA RODADA - SEMANA {N}* 🚨',
            '',
            '👑 *O Rei da Semana:* {Manager_Top} amassou com {Pontos} pts! Não deu nem pro cheiro.',
            '🥔 *O Saco de Pancadas:* Parabéns {Manager_Bottom}, {Pontos} pontos? O time entrou em campo ou foi pro churrasco?',
            '💔 *Injustiçado da Rodada:* {Manager} fez {Pontos} e mesmo assim perdeu por {Margem} pro {Rival}. Chora na cama que é lugar quente.',
            '⚔️ *Maior Clássico:* {Manager_A} ({Pts_A}) x ({Pts_B}) {Manager_B}. Com isso, o confronto direto agora está {Wins_A} x {Wins_B} pro {Líder}!',
            '```',
            '',
            '### 2. Plantão de Waivers (Quarta-feira)',
            '```text',
            '💰 *PLANTÃO DO WAIVER WIRE* 💰',
            '',
            '- {Manager} abriu o bolso e torrou ${FAAB} em {Jogador}. Vale tudo isso ou foi desespero?',
            '- 🎣 *Pescaria do Dia:* {Manager_2} pegou {Jogador} de graça no Free Agent logo após os waivers. Fiquem espertos!',
            '```',
            '',
            '### 3. Veredito de Troca (Imediato)',
            '```text',
            '🔄 *BOMBA NA LIGA: TROCA CONFIRMADA!* 🔄',
            '',
            '👥 {Manager_A} ➡️ Recebe: {Ativos_A}',
            '👥 {Manager_B} ➡️ Recebe: {Ativos_B}',
            '',
            '⚖️ *Veredito do Bot:* [Opinião afiada sobre quem saiu no lucro e quem cometeu um crime contra o próprio time].',
            '```'
        ];
        this.writeFile(path.join(agentDir, 'system_prompt_persona.md'), personaMd.join('\n'));
        files++;

        const toolDefs = {
            name: "SleeperLeagueKnowledgeBase",
            description: "Ferramentas para o agente Hermes consultar dados e gerar comentários para grupos de WhatsApp",
            tools: [
                {
                    name: "get_weekly_recap",
                    description: "Retorna o placar dos confrontos, maior pontuador, lanterna e waivers de uma semana",
                    parameters: {
                        type: "object",
                        properties: {
                            league_slug: { type: "string", description: "Slug da liga (ex: high-stakes-fantasy, dynasty-pantreta)" },
                            week: { type: "number", description: "Número da semana (1-18)" },
                            season: { type: "string", description: "Temporada (ex: 2024, 2025)" }
                        },
                        required: ["league_slug", "week"]
                    }
                },
                {
                    name: "get_h2h_rivalry",
                    description: "Retorna o histórico completo de confrontos diretos entre dois managers",
                    parameters: {
                        type: "object",
                        properties: {
                            league_slug: { type: "string" },
                            manager_a: { type: "string" },
                            manager_b: { type: "string" }
                        },
                        required: ["league_slug", "manager_a", "manager_b"]
                    }
                },
                {
                    name: "get_nfl_injuries_and_news",
                    description: "Retorna notícias recentes e boletim médico da NFL",
                    parameters: {
                        type: "object",
                        properties: {
                            category: { type: "string", enum: ["injury", "waiver", "trade", "general"] },
                            limit: { type: "number" }
                        }
                    }
                },
                {
                    name: "get_alltime_records",
                    description: "Retorna os maiores e menores recordes de pontuação da história da liga",
                    parameters: {
                        type: "object",
                        properties: {
                            league_slug: { type: "string" }
                        },
                        required: ["league_slug"]
                    }
                }
            ]
        };
        this.writeFile(path.join(agentDir, 'tool_definitions.json'), JSON.stringify(toolDefs, null, 2));
        files++;

        return files;
    }
}

export const kbGenerator = new KnowledgeBaseGeneratorService();
