# Surge — Fantasy Pot Tracker

Track your fantasy football league's weekly tax pot. The lowest scorer every week owes a penalty. The champion collects it all.

## Getting started

```bash
npm install
npm run dev        # → http://localhost:3000
```

## Routes

| Route | Description |
|---|---|
| `/` | Onboarding — choose Sleeper or Manual Mode |
| `/sleeper` | Search Sleeper username → pick a 2025 league |
| `/league/[id]` | Sleeper league dashboard (pot, standings, weekly recap) |
| `/league/[id]/payouts` | End-of-season payout breakdown |
| `/setup` | 3-step commissioner setup for Manual Mode |
| `/m/[id]` | Manual league dashboard |
| `/m/[id]/week` | Weekly results form for the commissioner |

## Modes

### Connect Sleeper
Links to a Sleeper account and auto-syncs rosters, weekly scores, and standings. No auth required — uses the public Sleeper API. Every week the lowest scorer owes **$25**.

### Manual Mode
Commissioner-controlled. Supports:
- **Base penalty** — lowest scorer each week (default $25)
- **Points threshold** — teams below a minimum score pay a tax
- **Touchdown threshold** — teams below a TD count pay a tax
- **Exemption rule** — if 2+ teams clear a milestone, they're exempt; others still pay

Milestone calculation:
- 0 teams clear → no milestone tax that week
- 1 team clears → that team is exempt, everyone else pays
- 2+ teams clear + exemption ON → clearers exempt, others pay
- 2+ teams clear + exemption OFF → all teams pay (no exemption)

Manual league data is stored in the browser's localStorage.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router |
| Styling | Tailwind CSS v3 (navy + emerald palette) |
| Icons | Lucide React (stroke only) |
| Data | [Sleeper API](https://docs.sleeper.com/) — public, no auth |
| Persistence | Supabase (Sleeper flow) · localStorage (Manual Mode) |

## Supabase (optional)

Copy `.env.local.example` → `.env.local` and add your project credentials. The app works fully without Supabase — it falls back to the $25 default.

```sql
create table pot_configs (
  id             uuid primary key default gen_random_uuid(),
  league_id      text not null unique,
  penalty_amount integer not null default 25,
  season         text not null,
  created_at     timestamptz default now()
);
```

## Design tokens

| Token | Value | Usage |
|---|---|---|
| `navy-950` | `#090d18` | Page background |
| `navy-900` | `#0d1525` | Sticky header |
| `navy-800` | `#111e32` | Card background |
| `navy-700` | `#1a2d47` | Card border, dividers |
| `navy-600` | `#233a5c` | Hover border |
| `emerald-400/500` | Tailwind built-in | Accent, CTA buttons |
| `slate-100/400/600` | Tailwind built-in | Primary / secondary / muted text |
