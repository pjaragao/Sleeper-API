# Sleeper Fantasy Assistant

AI-powered fantasy football assistant integrating with the [Sleeper API](https://docs.sleeper.com/).

## Features

- 🏈 **Complete Sleeper API Integration** - All endpoints supported
- 📊 **Local Database** - SQLite for development, Supabase-ready for production
- ⏰ **Automated Syncing** - Daily player/league updates via cron jobs
- 🔄 **Manual Sync** - API endpoints to trigger syncs on demand
- 🎯 **Full Data** - Players, leagues, rosters, matchups, transactions, drafts, brackets

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Database Migrations

```bash
npm run db:migrate
```

### 3. Sync Players (First Time)

```bash
npm run sync:players
```

This downloads ~12,000 NFL players from Sleeper (~5MB of data).

### 4. Start the Server

```bash
npm run dev
```

Server runs at `http://localhost:3001`

## API Endpoints

### Status & Health
- `GET /api/health` - Health check
- `GET /api/status` - System status with stats

### Players
- `GET /api/players` - List players (with search, filter by position/team)
- `GET /api/players/:id` - Get specific player
- `GET /api/players/trending/add` - Trending adds
- `GET /api/players/trending/drop` - Trending drops

### Leagues
- `GET /api/leagues` - List tracked leagues
- `POST /api/leagues` - Add league to track (`{ "leagueId": "123456" }`)
- `GET /api/leagues/:id` - Get league details
- `DELETE /api/leagues/:id` - Stop tracking league

### Rosters & Matchups
- `GET /api/leagues/:id/rosters` - Get all rosters
- `GET /api/leagues/:id/matchups/:week` - Get matchups for week
- `GET /api/leagues/:id/transactions` - Get transactions

### Sync (Manual Triggers)
- `POST /api/sync/players` - Sync all players
- `POST /api/sync/leagues` - Sync all leagues
- `POST /api/sync/league/:id` - Sync specific league
- `POST /api/sync/trending` - Sync trending players
- `POST /api/sync/nfl-state` - Sync NFL state

### NFL State
- `GET /api/nfl/state` - Current NFL week/season info

## Adding a League

```bash
# Using curl
curl -X POST http://localhost:3001/api/leagues \
  -H "Content-Type: application/json" \
  -d '{"leagueId": "YOUR_LEAGUE_ID"}'
```

Find your league ID in the Sleeper app URL: `sleeper.app/leagues/LEAGUE_ID`

## Scheduled Syncs

| Job | Schedule | Description |
|-----|----------|-------------|
| Players | 4:00 AM UTC | Full player database refresh |
| Leagues | 5:00 AM UTC | All leagues, rosters, brackets |
| Trending | Every hour | Trending adds/drops |

## Project Structure

```
├── src/
│   ├── config/
│   │   └── database.ts       # SQLite connection
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── run.ts
│   ├── routes/
│   │   └── api.routes.ts     # REST API
│   ├── services/
│   │   ├── sleeper-api.service.ts
│   │   ├── sync.service.ts
│   │   └── scheduler.service.ts
│   ├── scripts/
│   │   ├── sync-players.ts
│   │   └── sync-all.ts
│   └── index.ts              # Express server
├── data/
│   └── sleeper.db            # SQLite database
├── docs/
│   └── THEME.md              # UI theme reference
└── package.json
```

## Future: Supabase Migration

When ready for production:

1. Update `.env`:
```env
DB_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

2. Run migrations in Supabase SQL editor

3. The SQL is PostgreSQL-compatible with minor adjustments

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Server**: Express.js
- **Database**: SQLite (better-sqlite3)
- **HTTP Client**: Axios
- **Scheduler**: node-cron
