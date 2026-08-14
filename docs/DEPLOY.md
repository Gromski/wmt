# Deploying to Netlify (static publish model)

Warwick Massive Tunage ships to production as a **pre-rendered, read-only static
site**. All public pages are built from a committed data snapshot, so production
needs **no live database**. Data management (import, dates, attribution fixes)
happens **locally**; publishing new data is a rebuild.

## Architecture

| Environment | Role | Database |
|-------------|------|----------|
| Local (dev) | Admin: MusicKit import, date entry, attribution — the full app incl. auth | `local.db` (gitignored) |
| Netlify (prod) | Public read-only archive + analytics, prerendered | none at runtime — data baked at build from `data/archive.db` |

Public routes (`/`, `/analytics`, `/sessions`, `/sessions/[n]`) are statically
generated at build. The auth/dashboard/`/api/*` routes still build (as unused
serverless functions) but are not part of the public experience.

## One-time Netlify setup

1. Connect the GitHub repo in Netlify (build command + Next plugin come from `netlify.toml`).
2. In **Site config → Environment variables**, add a throwaway
   **`BETTER_AUTH_SECRET`** (e.g. `openssl rand -base64 32`). It only lets the
   unused auth/api route modules compile during the build — no real auth runs in
   production. No other env vars are required.

`netlify.toml` already sets `DATABASE_URL=file:data/archive.db` and `NODE_VERSION`.

## Publishing (each time the archive changes)

```bash
# 1. Manage data locally as usual (sign in, connect Apple Music, Sync sessions,
#    edit dates/attribution) — this updates local.db.

# 2. Regenerate the committed snapshot (music tables only — no auth/PII):
npm run db:snapshot

# 3. Commit + push. Netlify rebuilds and republishes the static site.
git add data/archive.db && git commit -m "data: refresh archive snapshot" && git push
```

## Notes

- `data/archive.db` contains only `sessions`, `tracks`, `session_tracks`,
  `contributors`, `artist_tags` — never the Better Auth `user`/`session`/`account`
  tables, so no credentials or PII are committed.
- Because production is static, there is no in-prod login or import. To change
  data you re-run the local flow and repeat the publish steps above.
- To verify the production build locally (mimics Netlify):
  ```bash
  DATABASE_URL=file:data/archive.db BETTER_AUTH_SECRET=local-build-check npm run build
  ```
