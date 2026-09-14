# Case de Estudo: Sleeper Fantasy Assistant

> **Sleeper Fantasy Assistant** – Inteligência Analítica e Automação de Dados para Fantasy Football.

## 📌 Visão Executiva (Executive Summary)

O **Sleeper Fantasy Assistant** é uma plataforma analítica de alto desempenho construída para revolucionar a forma como os managers de *Fantasy Football* interagem com os dados da liga. Atuando como uma camada de inteligência acima do aplicativo nativo da Sleeper, a aplicação ingere, processa e analisa um volume massivo de dados (mais de 12.000 jogadores, histórico completo de *drafts*, *rosters* e transações) para fornecer insights táticos acionáveis.

Seu propósito central é eliminar a adivinhação e a análise manual no Fantasy Football. Através de um motor de sincronização autônomo e um robusto algoritmo de avaliação (*grading*), a ferramenta transforma dados brutos da API da Sleeper em vantagens competitivas reais, entregando relatórios de *Manager Tendencies* e notas precisas de *Draft* baseadas no desvio de ADP (*Average Draft Position*).

A proposta de valor é clara: **dar aos usuários uma vantagem informacional assimétrica e automatizar horas de pesquisa semanal**, oferecendo uma interface premium, rápida e analiticamente profunda.

---

## 🎯 Público-Alvo e Modelo de Negócio

- **Público-Alvo**: *Fantasy Football Managers* competitivos (redraft e dynasty), Comissários de Ligas que buscam engajar seus participantes com relatórios detalhados, e criadores de conteúdo do nicho de esportes.
- **Modelo de Negócio**: Estruturado com potencial para *SaaS (Software as a Service)* voltado a nichos esportivos (*B2C* premium) ou como uma ferramenta *Freemium* para construir uma comunidade engajada e ser monetizada via parcerias e patrocínios no setor de apostas e *daily fantasy*.

---

## ⚠️ O Problema Resolvido (The Challenge)

**A Dor**: No Fantasy Football moderno, as margens de vitória são mínimas. Acompanhar a flutuação do mercado de *waivers*, analisar o comportamento histórico dos adversários no *draft* e julgar objetivamente a qualidade do seu próprio time requer a extração manual de dados que os aplicativos padrão não fornecem de forma correlacionada. 
**O Impacto**: Sem ferramentas analíticas, *managers* tomam decisões baseadas em viés emocional. 
**A Solução**: O sistema resolve isso automatizando um *Data Pipeline* completo que roda em *background* diariamente. Ele detecta movimentos bruscos de *Waiver Wire* (adições/quedas de tendência) e processa cálculos matemáticos complexos para gerar um diagnóstico instantâneo da saúde de cada time da liga.

---

## 🏗️ Arquitetura e Tech Stack

A arquitetura foi desenhada para ser altamente assíncrona e resiliente à ingestão de dados pesados, garantindo a melhor experiência de UI/UX possível no *Frontend*.

* **Backend (API & Workers)**: `Node.js` com `TypeScript` e `Express.js`. Escolhido pela excelente capacidade de lidar com I/O assíncrono (milhares de requisições de rede para a API da Sleeper) e orquestrar *cron jobs* via `node-cron`.
* **Banco de Dados**: Atualmente operando em `SQLite` (`better-sqlite3`) para garantir um ambiente de desenvolvimento e processamento local ultrarrápido (inserção em lote via transações atômicas). A modelagem já foi idealizada e tipada para uma migração direta e indolor para o **Supabase (PostgreSQL)** em produção.
* **Frontend**: `Next.js 16` (App Router) e `React 19`. Adoção do estado da arte em frameworks web para garantir SSR/SSG rápido e SEO robusto.
* **Estilização & Design System**: `TailwindCSS v4` com um sistema maduro de variáveis CSS nativas para alternância de temas (Light/Dark mode). Componentes estilizados para passar uma percepção visual *premium* e moderna, utilizando paletas de cores harmônicas e micro-interações.

---

## 🧠 Integrações, APIs e Pipeline Analítico

O coração da aplicação é a sua comunicação com o mundo externo e sua capacidade de processar essas informações:

1. **Sleeper API Gateway**: Integração profunda e tipada com todos os *endpoints* públicos da Sleeper. O sistema é capaz de buscar estados semanais da NFL, perfis de usuários, chaves de *playoffs* (Winners/Losers brackets), além de mapear complexos relacionamentos de escolhas de draft trocadas (*Traded Picks*).
2. **Motor Analítico e Algoritmo de Avaliação (Draft Analytics Engine)**:
   - Em vez de ser um simples *wrapper* de LLMs (como OpenAI), a "Inteligência" atual reside num forte **motor algorítmico e determinístico**.
   - **Cálculo de Desvio de ADP**: O sistema cruza o momento exato em que um jogador foi escolhido (`pick_no`) com o seu ranking de busca global (*ADP proxy*). Ele gera um `value_score` que recompensa escolhas de valor e pune *reaches*.
   - **Curva de Normalização**: Os resultados brutos das equipes não são absolutos. O algoritmo normaliza estatisticamente as notas baseadas na performance relativa do *draft* em si (distribuindo *grades* de 45 a 95, de **A+** a **F**).
3. **Manager Tendencies Profiling**: Uma rotina de análise comportamental que varre o histórico de *drafts* de um usuário e extrai sua matriz de preferências (ex: propensão a escolher *Running Backs* nos rounds iniciais), permitindo que adversários antecipem suas jogadas. O sistema está estruturado para injetar os resultados dessas engrenagens em modelos de *LLM/Genkit* no futuro, permitindo explicações textuais automatizadas.

---

## ⚙️ Soluções e Funcionalidades Core

- 🔄 **Global Sync Engine**: *Workers* em *background* que sincronizam as flutuações de jogadores da NFL na calada da noite (4:00 AM UTC), garantindo que os usuários acordem com o banco de dados e as tendências de *waiver* atualizados.
- 📊 **Draft Board & Analytics Panel**: Reconstrução visual completa da matriz do *Draft*, cruzando dados de quem fez a escolha *vs* dono original da escolha, injetando análises de valor de cada *pick* em tempo real.
- 📈 **Trending Market Monitor**: Monitoramento contínuo a cada hora sobre as movimentações macro da NFL, revelando quem são os jogadores mais adicionados ou dispensados (Add/Drop Trends).

---

## 🚀 Desafios Técnicos Superados

### 1. Ingestão Massiva de Dados e Rate-Limiting
**O Desafio**: Sincronizar o estado completo da liga (mais de 12.000 jogadores da NFL, transações de 18 semanas, *matchups* e elencos) pode facilmente estrangular a memória do servidor ou esbarrar nos limites de requisição da API externa.
**A Solução**: Implementação de uma arquitetura de transações atômicas em lotes (*batch processing* de 1.000 registros por transação no SQLite via `better-sqlite3`). Isso reduziu o custo de I/O em ordens de grandeza, permitindo que milhares de registros sejam atualizados na base local em frações de segundo, minimizando gargalos de *runtime* no Node.js.

### 2. Normalização Estatística de Desempenho (Draft Grading)
**O Desafio**: Criar uma avaliação de "Nota de Draft" que fosse justa e realista, independentemente se a liga é rasa ou profunda, evitando que todas as equipes tirassem notas medianas.
**A Solução**: Desenvolvimento de um modelo matemático de normalização de desvios de ADP. O motor captura o `avg_adp_deviation` de cada equipe, encontra a amplitude (*range*) dos desvios dentro daquele *draft* específico, e escala os resultados em uma curva para uma faixa de 45 a 95 pontos. Isso garante que a nota seja um reflexo direto do quão melhor ou pior o usuário "drafou" em relação **exclusivamente aos seus adversários de liga**, gerando um sistema de *feedback* dinâmico e gamificado.
