# brain — plan

A tiny local Kanban for tracking work, especially autonomous AI-agent work that needs a human in the loop.
One bun process at login serves the API and the web UI. A `brain` CLI and a Claude skill let agents file,
update and read issues; the human uses the PWA to triage, comment and delete.

## Decisions (from grill session, 2026-09-03)

| Area | Decision |
|---|---|
| Runtime | Single Bun process: Hono serves `/api/*` and the built Vite bundle. launchd LaunchAgent at login. |
| Repo | bun workspace: `packages/shared`, `packages/server`, `packages/web`, `packages/cli`. |
| DB | `bun:sqlite`, file at `~/.brain/brain.db` (override `BRAIN_DB`). Port 4400 (override `BRAIN_PORT`). |
| Columns | `todo`, `needs_attention`, `blocked`, `resolved`. |
| Issue | id (int), title, description (markdown, optional), status, project (optional), created_by, created_at, updated_at. |
| Comments | Separate table: id, issue_id, author, body (markdown), created_at. |
| Authorship | Free text. UI defaults `me`; CLI defaults `agent`, `--author` overrides. |
| Live updates | SSE `/api/events`; client refetches via TanStack Query on `changed`. |
| Detail view | shadcn Sheet over the board. Lexical markdown editor. Column select, project, comments, delete. |
| CLI | `brain` talks to the HTTP API. `--json` everywhere for agents. Clear error if server is down. |
| Skill | `.claude/skills/brain/SKILL.md` in repo; `bun run install` symlinks to `~/.claude/skills/brain`. |
| Delete | Hard delete (cascades comments). |
| Quality | `bun test` on server + CLI; final browser smoke check of the UI. |

## API contract (see packages/shared/src/index.ts)

```
GET    /api/issues?status=&project=          -> Issue[]  (ordered by updated_at desc)
POST   /api/issues                            -> Issue    { title, description?, status?, project?, created_by? }
GET    /api/issues/:id                        -> IssueWithComments
PATCH  /api/issues/:id                        -> Issue    { title?, description?, status?, project? }
DELETE /api/issues/:id                        -> 204
DELETE /api/issues?status=<s>                 -> 200 { deleted: n }   (clear a column; emits kind "bulk")
POST   /api/issues/:id/comments               -> Comment  { author?, body }
DELETE /api/comments/:id                      -> 204
GET    /api/attention                         -> Issue[]  (status in needs_attention, blocked)
GET    /api/events                            -> SSE: event "changed" { kind, id }
GET    /api/health                            -> { ok: true }
```

Errors: `{ error: string }` with 400/404. Validation via zod schemas in `shared`.

## Work packages (parallel after scaffold)

1. **server** — Hono app, sqlite schema + migrations-on-boot, routes, SSE bus, static serving of `web/dist`, tests.
2. **web** — Vite + React + Tailwind + shadcn, dnd-kit board, Sheet detail with Lexical markdown editor, comments, PWA manifest + service worker (vite-plugin-pwa), SSE hook.
3. **cli + skill + install** — `brain` CLI (commander-style, minimal deps), SKILL.md, launchd plist template, `scripts/install.ts`, README.
4. **verify** — run everything, browser smoke test, code review, fix-ups.

## Added 2026-09-03 (after first install)
- Clear column: `DELETE /api/issues?status=`, column header menu in the UI with inline confirm, `brain clear <status>` in the CLI.
- Attention signal: web app sets the PWA Dock badge (`navigator.setAppBadge`) to the count of needs_attention + blocked while the window is open. Server sends a macOS notification (osascript) when an issue enters needs_attention or blocked; disable with `BRAIN_NOTIFY=0`.

## Non-goals for v1
Auth (localhost only), multi-user sync, priorities, attachments, auto-archiving resolved.
