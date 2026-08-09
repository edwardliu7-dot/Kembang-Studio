# Personal AI Development Studio

IDE berbasis browser yang berjalan lokal — pengganti Replit untuk penggunaan pribadi di laptop. Satu pengguna, satu proyek aktif, semua data tersimpan lokal.

## Run & Operate

- Frontend: `pnpm --filter @workspace/studio run dev` — React Vite app (port auto-assigned via workflow)
- API Server: `pnpm --filter @workspace/api-server run dev` — Express backend (port 8080)
- Default password: `studio` (ubah via env var `STUDIO_PASSWORD` sebelum pertama kali start)
- Data disimpan di `~/dev-studio/studio.db` (SQLite)
- Encryption key di `~/dev-studio/.key` (jangan hapus)

## Stack

- Frontend: React + Vite + TailwindCSS + shadcn/ui + Monaco Editor + xterm.js
- Backend: Node.js + Express 5
- Database: SQLite (better-sqlite3) — tidak pakai PostgreSQL
- Terminal: node-pty + WebSocket (path: /ws/terminal)
- Git: simple-git
- AI: OpenAI-compatible API (Groq, OpenAI, Gemini, Anthropic, Ollama)
- Auth: bcryptjs + express-session
- Secrets: AES-256-GCM encryption

## Where Things Live

- Frontend pages: `artifacts/studio/src/pages/` (Login, Projects, Studio, Design, Settings)
- Frontend components: `artifacts/studio/src/components/` (AiChat, Editor, FileTree, GitPanel, TerminalPanel, etc.)
- API routes: `artifacts/api-server/src/routes/` (auth, projects, files, git, secrets, checkpoints, build, ai, studio)
- Database: `artifacts/api-server/src/db.ts` (SQLite schema + init)
- Terminal WebSocket: `artifacts/api-server/src/terminal.ts`
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`

## Architecture Notes

- SQLite dipakai langsung di api-server (TIDAK pakai lib/db yang PostgreSQL)
- WebSocket terminal: `/ws/terminal?projectId=X` — pakai node-pty
- Secret values tidak pernah dikirim ke browser — hanya nama (key) yang tampil
- Preview proxy: `/preview` path di api-server, teruskan ke port proyek aktif
- AI gateway: OpenAI-compatible format, semua provider (Groq, OpenAI, Gemini, Anthropic, Ollama)
- Checkpoint = git commit lokal dengan prefix `[checkpoint]`

## User Preferences

- Bahasa Indonesia untuk komunikasi
- Dark mode by default
- Tidak pakai emoji di UI
- App berjalan lokal (tidak perlu cloud deployment)

## Gotchas

- codegen fix: `zod.int()` → `zod.number()` via sed post-process di codegen script (Orval 8.23.0 generates Zod v4 syntax tapi project pakai Zod v3)
- node-pty dan better-sqlite3 butuh native build — jalankan `pnpm rebuild better-sqlite3 node-pty` jika ada error setelah install ulang
- Tidak pakai `lib/db` (PostgreSQL/Drizzle) — pakai better-sqlite3 langsung di api-server
- `@types/node-pty` tidak ada di npm — gunakan dynamic import dengan type annotation manual
