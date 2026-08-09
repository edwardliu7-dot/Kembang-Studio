---
name: SQLite backend pattern
description: This project's api-server uses SQLite (better-sqlite3) directly, not the shared lib/db PostgreSQL package. Native rebuild required after install.
---

The Personal Dev Studio backend uses `better-sqlite3` directly in `artifacts/api-server/src/db.ts`. Schema is created via `db.exec(...)` on startup (not Drizzle push).

**Why:** The app is designed for local-only use. SQLite requires zero setup vs PostgreSQL.

**How to apply:**
- Do NOT use `lib/db` or `@workspace/db` in the api-server for this project.
- After installing `better-sqlite3` or `node-pty` via pnpm, run: `pnpm rebuild better-sqlite3 node-pty` (these are native modules).
- `@types/node-pty` does not exist on npm — use dynamic import with manual type annotation.
- DB file lives at `~/dev-studio/studio.db`. Encryption key at `~/dev-studio/.key`.
