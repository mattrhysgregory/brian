# brian

A small local Kanban board for keeping track of work, especially the work your
AI agents do on your behalf. Agents file cards when they need you. You reply
from the board. They pick up your reply and carry on.

It runs on your machine, starts at login, and stores everything in one SQLite
file. Nothing leaves your laptop. (The name is a play on "brain". Squint.)

## The problem it solves

Once you have several AI agents working autonomously across several repos, the
bottleneck stops being the agents and becomes you. Each one finishes a task and
wants a review, or gets stuck waiting on a decision, a credential, or a piece
of context only you have. That state lives in scattered terminal sessions, and
it is easy to lose track of who is waiting on what, or to only find out when
you happen to scroll back.

brian gives that state one home. Agents write to it, you read and reply from
it, and agents read your reply back. It is deliberately tiny: four columns,
comments, markdown, and nothing else.

## The three parts

**The app** is a single Bun process that serves a small HTTP API and the web
board from the same port. It owns the SQLite database, pushes live updates to
the board over server-sent events, and fires a macOS notification when a card
enters Needs attention or Blocked. It is installed as a launchd login service,
so it is always running. The board is a PWA you can install from Chrome, which
gets you a Dock icon with a badge showing how many cards need you.

**The CLI** is the `brian` command. It is a thin client over the API and is
how agents talk to the board: file a card, move it, comment, read a thread.
Every command has a `--json` flag so an agent gets clean, parseable output. You
can use it too, but the board is nicer for humans.

**The skill** is a short markdown file that teaches Claude Code when and how to
use the CLI. It lives in this repo and is symlinked into `~/.claude/skills`, so
every Claude session on the machine picks it up automatically. It says: file to
Needs attention when work needs review, file to Blocked when you are stuck and
say exactly what you need, tag cards with the repo name, check the board for
human replies, and only resolve a card when the human's reply actually closes
it. If you want agents to behave differently, you edit that one file.

The loop, end to end:

```
  Claude Code (any repo)                        You
  ─────────────────────                         ───
  finishes a task / gets stuck                  see notification + Dock badge
        │                                             │
        ▼   brian add … --status attention            ▼
  ┌──────────────────────────────────────────────────────────┐
  │  todo   │  needs attention  │  blocked  │  resolved       │   ← board
  └──────────────────────────────────────────────────────────┘
        ▲                                             │
        │   brian show <id> --json                    ▼
  reads your comment, continues, moves to resolved    comment / drag / delete
```

## Install

You need [Bun](https://bun.sh) 1.4 or newer and macOS for the login service
(other platforms work but must start the server by hand).

```sh
git clone https://github.com/mattrhysgregory/brian ~/git/brian
cd ~/git/brian
bun install
bun run install:brian
```

That builds the web app, installs the `brian` command, installs the Claude
skill globally, and registers a launchd service that runs the server at login.
When it finishes, open <http://localhost:4400>.

**Install it as an app.** In Chrome, click the install icon at the right of the
address bar (or Chrome menu, then "Install brian"). You get a Dock icon, a
standalone window, and a badge showing how many cards need you.

To preview what the installer will do without changing anything:
`bun run scripts/install.ts --dry-run`.

## The board

Four columns, in the order work flows:

| Column | Meaning |
|---|---|
| Todo | Queued work. Yours or an agent's. |
| Needs attention | An agent finished something and wants a review, an answer, or a decision. |
| Blocked | An agent cannot continue without something from you. |
| Resolved | Done. Clear it out whenever you like. |

Things you can do:

- **New** creates a card. Title is required, description is optional markdown.
- **Click a card** to open it. Edit the title inline, change the column, set a
  project, and write the description in a rich-text editor that reads and
  writes markdown.
- **Drag cards** between columns using the grip handle that appears on hover.
  Keyboard works too: focus the handle, press Space, use the arrow keys, press
  Space again.
- **Comment** at the bottom of a card. Cmd+Enter posts. Your comments are
  authored as "me", so agents can tell your replies from their own notes.
- **Delete** a card from inside it, or clear a whole column from the "…" menu
  in the column header. Both ask for confirmation inline.
- **Filter by project** using the dropdown in the top bar.

The board updates live. When an agent files or changes a card, it appears
without a refresh.

## Using it with Claude

The installer puts a skill at `~/.claude/skills/brian`, so every Claude Code
session on your machine knows about the board. You do not need to configure
anything per repo.

**Claude files cards on its own** when it hits one of these situations:

- It finished a piece of autonomous work and wants you to review it. The card
  lands in Needs attention.
- It is stuck on a decision, a credential, access, or missing context. The
  card lands in Blocked with a description of exactly what it needs.
- It noticed follow-up work it is not doing now. The card lands in Todo.

Cards are tagged with the repo name as the project and a short author name, so
you can see which repo and which session raised it.

**You can also ask directly.** Some prompts that work well:

```
What needs my attention?
Track this as a task: migrate the auth middleware to the new session store.
Check the brian board for anything about the payments repo and act on my replies.
File a card asking me to review this PR when you're done.
Resolve #12, I've answered your question on the board.
```

**The daily loop** looks like this:

1. A notification arrives, or the Dock badge ticks up.
2. Open the board, read the card, reply in the comments. Move it if you like,
   but you don't have to.
3. Next time Claude works in that repo, or when you tell it to check, it reads
   your reply, acts on it, and moves the card to Resolved.

**Get Claude to check at the start of every session.** Add a session hook to
`~/.claude/settings.json` so open items for the current repo are in front of
Claude before it starts:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "brian attention --project \"$(basename \"$PWD\")\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

**A note on trust.** Agents can create, edit, comment on, move, and delete
individual cards. The skill tells them to only file things that genuinely need
a human, to never clear whole columns, and to only resolve a card when your
reply actually closes it. If an agent gets this wrong, it is a prompt problem.
Edit `.claude/skills/brian/SKILL.md` in this repo and the change applies
everywhere, because the global skill is a symlink.

## Notifications and the Dock badge

When a card enters Needs attention or Blocked, the server shows a macOS
notification. It arrives from "Script Editor" because that is how command-line
notifications work on macOS. If you don't see one, allow Script Editor under
System Settings, Notifications. Set `BRIAN_NOTIFY=0` to turn them off.

The installed app also sets the Dock badge to the number of cards in Needs
attention plus Blocked. The badge only updates while the app window is open,
even in the background, so leave it running if you want the count to be
accurate.

## CLI

The same `brian` command your agents use. Everything takes `--json`.

```sh
brian add "<title>" [--desc <md> | --desc-file <path> | --desc-file -] [--status <s>] [--project <p>] [--author <a>]
brian list [--status <s>] [--project <p>] [--all]     # hides resolved unless --all
brian attention [--project <p>]                       # needs_attention + blocked, with latest comment
brian show <id>
brian move <id> <status>                              # aliases: attention, done
brian edit <id> [--title <t>] [--desc <md>] [--project <p>]
brian comment <id> "<body>"                           # or - to read stdin
brian rm <id>
brian rm-comment <id>
brian clear <status>                                  # deletes a whole column
brian open                                            # opens the board
```

Statuses are `todo`, `needs_attention`, `blocked`, `resolved`. If the server is
not running the CLI says so and exits with code 2.

## Configuration

| Variable | Default | What it does |
|---|---|---|
| `BRIAN_PORT` | `4400` | Port the server listens on |
| `BRIAN_DB` | `~/.brian/brian.db` | Where the database lives |
| `BRIAN_URL` | `http://localhost:4400` | Where the CLI looks for the server |
| `BRIAN_NOTIFY` | on | Set to `0` to disable macOS notifications |

Set `BRIAN_PORT` or `BRIAN_DB` in your shell before running the installer and
they are baked into the login service. Re-run the installer if you change them.

Logs are in `~/.brian/logs/`. To restart the service after pulling changes:

```sh
bun run build
launchctl kickstart -k gui/$UID/com.brian.server
```

## Sharing with your team

Each person clones the repo and runs the installer. Everyone gets their own
board and database. There is no sync, and the server only listens on
localhost, so nothing is shared by accident.

If your machine sits behind a corporate proxy that rewrites TLS, `bun install`
may fail with a certificate error. Point bun at your CA once:

```sh
bun install --cafile "/path/to/your/corporate-ca.pem"
```

## Uninstall

```sh
bun run scripts/uninstall.ts
```

Stops and removes the login service, unlinks the CLI, and removes the skill
symlink. Your database at `~/.brian/brian.db` is left in place; delete it
yourself if you want a clean slate.

## For developers

Bun workspace with four packages:

| Package | What |
|---|---|
| `packages/shared` | Types and zod schemas. The contract everything else follows. |
| `packages/server` | Hono on Bun, `bun:sqlite`, server-sent events, static serving, notifications. |
| `packages/web` | Vite, React, Tailwind, shadcn, dnd-kit, Lexical, PWA. |
| `packages/cli` | The `brian` command. Talks to the server over HTTP. |

```sh
bun run dev          # server in watch mode + Vite dev server with /api proxied
bun run test         # bun test across the workspace
bun run typecheck
bun run build        # builds the web bundle the server serves
```

Design decisions and the API contract are in `docs/PLAN.md`. The server is
localhost-only and unauthenticated. Writes carrying an `Origin` header from
any host other than localhost are rejected, which stops random web pages from
poking at your board.
