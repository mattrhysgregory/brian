# brain

A tiny local Kanban for tracking work — especially autonomous AI-agent work
that needs a human in the loop. One Bun process serves the API and the web
UI; a `brain` CLI and a Claude Code skill let agents file, update, and read
issues; a PWA lets you triage, comment, and delete them.

Columns: `todo`, `needs_attention`, `blocked`, `resolved`.

## Quick start

```sh
bun install
bun run install:brain   # builds the web UI, installs the CLI + skill, starts the launchd service
```

Then open <http://localhost:4400>.

`install:brain` runs `scripts/install.ts`, which:

1. builds `packages/web` (skip with `--no-build`)
2. symlinks `.claude/skills/brain` → `~/.claude/skills/brain`
3. links the `brain` CLI globally (`bun link`)
4. **macOS only** — installs and loads a launchd LaunchAgent
   (`com.brain.server`) that runs the server at login and keeps it alive, and
   waits for `/api/health`. On any other platform this step is skipped with a
   note: start the server yourself with `bun run start`, or wrap that command
   in a systemd user unit.

If `BRAIN_PORT` or `BRAIN_DB` are set in the shell you run the installer from,
they are copied into the LaunchAgent's `EnvironmentVariables` so the login
service uses the same port and database. Re-run the installer after changing
them.

Preview any of this without changing anything: `bun run scripts/install.ts --dry-run`.

## Dev workflow

```sh
bun run dev    # runs the server (watch mode) and the Vite dev server together
bun run test   # bun test across the workspace
bun run typecheck
```

The server alone: `bun run start` (serves `/api/*` and, once built, the
static web bundle from `packages/web/dist`).

## CLI cheat-sheet

```sh
brain add "<title>" [--desc <md>|--desc-file <path>|-] [--status <s>] [--project <p>] [--author <a>]
brain list [--status <s>] [--project <p>] [--all]
brain attention [--project <p>]    # needs_attention + blocked, with latest comment
brain show <id>
brain move <id> <status>           # aliases: attention -> needs_attention, done -> resolved
brain edit <id> [--title] [--desc|--desc-file] [--project]
brain comment <id> "<body>"|-      # - reads the body from stdin
brain rm <id>
brain rm-comment <id>
brain open                         # opens the board in your browser
```

Every command supports `--json` (raw API response, nothing else — for
scripting). Talks to `BRAIN_URL` (default `http://localhost:4400`). If the
server isn't reachable it prints a clear message to stderr and exits 2.

## The skill

`.claude/skills/brain/SKILL.md` teaches Claude Code when to file an issue
(finished work needing review → `needs_attention`; blocked → `blocked`;
follow-up work → `todo`; human reply resolves it → `resolved`), how to check
for human replies (`brain show <id> --json`), and the conventions to use
(`--project <repo>`, a short `--author`). `.claude/skills/brain/reference.md`
has the full CLI reference. Installed automatically by `install:brain`; any
Claude Code session on the machine picks it up from `~/.claude/skills/brain`.

## Config

| Env var | Default | Meaning |
|---|---|---|
| `BRAIN_PORT` | `4400` | Port the server listens on |
| `BRAIN_DB` | `~/.brain/brain.db` | SQLite database path |
| `BRAIN_URL` | `http://localhost:4400` | Base URL the CLI/web use to reach the server |

`BRAIN_PORT` and `BRAIN_DB` are propagated into the launchd plist at install
time (see above), so the background service and your shell agree.

The server is localhost-only and unauthenticated. As a cheap CSRF guard, any
non-GET `/api/*` request carrying an `Origin` header from a host other than
`localhost`/`127.0.0.1` is rejected with 403. Requests with no `Origin` (the
CLI, curl) are unaffected.

## Uninstall

```sh
bun run scripts/uninstall.ts            # unloads the launchd agent, unlinks the CLI, removes the skill symlink
bun run scripts/uninstall.ts --dry-run  # preview only
```
