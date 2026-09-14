# 🏈 Sleeper Fantasy Football - Base de Conhecimento do Agente Hermes

Esta base de conhecimento foi gerada automaticamente para alimentar o **Bot de IA para WhatsApp**.
O agente Hermes utiliza estes documentos e consultas SQL para atuar como o comentarista oficial das ligas.

## 📂 Estrutura de Diretórios

- **`leagues/`**: Dossiês completos de cada liga, históricos multi-temporadas, rivalidades e recordes.
- **`nfl/`**: Placares reais da NFL (ESPN), melhores desempenhos, boletim médico e notícias.
- **`agent/`**: Instruções de persona, regras de conduta para o WhatsApp e ferramentas.

## 🏆 Ligas Mapeadas no Sistema

| Liga | Temporadas | Slugs de Acesso |
|---|---|---|
| **Dynasty Javali 2.0** | 2022, 2023, 2024, 2025, 2026 | [`dynasty-javali-2-0`](./leagues/dynasty-javali-2-0/LEAGUE_DOSSIER.md) |
| **Dynasty Pantreta** | 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 | [`dynasty-pantreta`](./leagues/dynasty-pantreta/LEAGUE_DOSSIER.md) |
| **High Stakes Fantasy** | 2022, 2023, 2024, 2025, 2026 | [`high-stakes-fantasy`](./leagues/high-stakes-fantasy/LEAGUE_DOSSIER.md) |
| **Liga Bears BR 🐻🏈** | 2025, 2026 | [`liga-bears-br`](./leagues/liga-bears-br/LEAGUE_DOSSIER.md) |
| **OS MORMAII** | 2021, 2022, 2023, 2024, 2025, 2026 | [`os-mormaii`](./leagues/os-mormaii/LEAGUE_DOSSIER.md) |

## 💡 Como o Agente Hermes Deve Operar no WhatsApp

1. **Resumos Pós-Rodada (Terça-feira)**: Ler `week_{N}.md` da liga e comparar com os recordes históricos (`ALL_TIME_RECORDS.md`).
2. **Plantão de Waivers (Quarta-feira)**: Comentar as escolhas mais caras de FAAB e zoar quem dropou titulares.
3. **Veredito de Trocas**: Consultar `TRADE_HISTORY.md` e avaliar quem levou a melhor na negociação.
4. **Confrontos Diretos (Sexta-feira)**: Consultar `H2H_RIVALRIES.md` antes dos jogos para esquentar a rivalidade no grupo.
5. **Plantão Médico de Domingo**: Verificar `injuries_and_status.md` antes do kickoff.
