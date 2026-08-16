# Warwick Massive Tunage

A browsable archive and analytics for the music sessions four friends (Mark, Jack,
Jon, Iwan) have run over Teams — 31+ themed sessions, four songs each, pulled from
Apple Music and enriched with Last.fm genre tags.

Production is a **pre-rendered, read-only static site** on Netlify. Data management
(importing sessions, entering dates, fixing attribution) happens **locally**;
publishing new data is a rebuild. See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full
deployment model.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM + libSQL/SQLite ·
Better Auth · Tailwind v4 + shadcn/ui · Recharts · Biome.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in the values (see that file)
npm run dev                          # http://127.0.0.1:3000
```

Local dev uses a SQLite file (`DATABASE_URL=file:local.db`). To manage data you sign
in as admin, open `/dashboard`, connect Apple Music (MusicKit), and run the import.
Importing/date-entry/attribution require the Apple + Last.fm keys in `.env.local`.

## Adding a new session (publishing)

New sessions are added locally, then published by committing a refreshed data
snapshot — Netlify rebuilds the static site from it. There is no live database or
admin UI in production.

```bash
# 1. Manage data locally (updates local.db):
#    - npm run dev, sign in as admin, go to /dashboard
#    - connect Apple Music and click "Start import" to sync sessions
#    - set the session date and fix any attribution flags on the dashboard

# 2. Regenerate the committed data snapshot (music tables only — no auth/PII):
npm run db:snapshot

# 3. Commit the snapshot and push — Netlify rebuilds and republishes:
git add data/archive.db
git commit -m "data: add session NN (<theme>)"
git push
```

The public pages (`/`, `/analytics`, `/sessions`, `/sessions/[n]`) are prerendered at
build from `data/archive.db`, so the new session appears once the Netlify build
finishes. `data/archive.db` never contains the Better Auth `user`/`session`/`account`
tables — only `sessions`, `tracks`, `session_tracks`, `contributors`, `artist_tags`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (prerenders public pages) |
| `npm run db:push` | Apply the Drizzle schema to `local.db` |
| `npm run db:snapshot` | Regenerate `data/archive.db` from `local.db` for publishing |
| `npm run db:studio` | Drizzle Studio |
| `npm run lint` / `npm run typecheck` | Biome check / TypeScript check |

## Deployment

One-time Netlify setup and the publish flow are documented in
[`docs/DEPLOY.md`](docs/DEPLOY.md). In short: connect the repo (build config comes
from `netlify.toml`), set a throwaway `BETTER_AUTH_SECRET` in the Netlify UI, and
push. No runtime database is required.
