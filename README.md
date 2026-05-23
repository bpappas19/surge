# ⚡ Surge — Fantasy Pot Tracker

Track your Sleeper fantasy football league's pot. The lowest scorer every week owes **$25**. The champion takes it all.

## Features

- **Homepage** — enter a Sleeper username, browse all 2025 NFL leagues
- **League Dashboard** — live pot total, per-team tax standings, weekly recap of who scored lowest
- **Payout Screen** — end-of-season breakdown showing exactly who owes the champion (and how much)

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS v3 |
| Database | Supabase (optional — for custom pot configs) |
| Data | [Sleeper API](https://docs.sleeper.com/) — no auth required |

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase (optional)

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials. The app works fully without Supabase — it falls back to the default $25 penalty amount.

```bash
cp .env.local.example .env.local
```

### Database schema

```sql
create table pot_configs (
  id           uuid primary key default gen_random_uuid(),
  league_id    text not null unique,
  penalty_amount integer not null default 25,
  season       text not null,
  created_at   timestamptz default now()
);
```

## Project structure

```
app/
  page.tsx                          # Homepage — username search + league picker
  league/[leagueId]/
    page.tsx                        # League dashboard
    payouts/page.tsx                # End-of-season payout screen
components/
  Logo.tsx                          # Surge wordmark + lightning bolt
lib/
  sleeper.ts                        # Sleeper API client + types
  supabase.ts                       # Supabase client (graceful no-op if unconfigured)
```

## Sleeper API endpoints used

| Endpoint | Purpose |
|---|---|
| `GET /user/{username}` | Resolve username → user_id |
| `GET /user/{user_id}/leagues/nfl/2025` | Fetch all leagues |
| `GET /league/{league_id}` | League settings + status |
| `GET /league/{league_id}/rosters` | Roster → owner mapping |
| `GET /league/{league_id}/users` | Display names + team names |
| `GET /league/{league_id}/matchups/{week}` | Weekly scores |
| `GET /league/{league_id}/winners_bracket` | Playoff bracket → champion |

## How the pot works

- Each regular-season week, the team with the **lowest score** owes $25 to the pot
- At season end, the **league champion** collects the entire pot
- If the champion was also a low scorer, that amount is deducted from their prize
