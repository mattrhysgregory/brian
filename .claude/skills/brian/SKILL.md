---
name: brian
description: File, update, and check human-in-the-loop tracking issues in the local brian kanban. Use this when you finish autonomous work that needs human review, get blocked on a decision/credentials/missing context, want to leave follow-up work for later, need to check whether a human has replied to something you filed, or the user asks what needs attention / to track a task.
---

# brian

`brian` is a tiny local kanban CLI for tracking work between you (an agent)
and the human. Columns: `todo`, `needs_attention`, `blocked`, `resolved`.

Full command reference: `reference.md` in this skill directory.

## When to file something

- **Finished work that needs human review or a decision** → file (or move) to
  `needs_attention`. Example: you shipped a change and want a sanity check,
  or you have a question that has an easy answer but you're not sure.
- **Blocked on a decision, credentials, access, or missing context** → file
  to `blocked`. Say exactly what you need in the description.
- **New follow-up work you noticed but aren't doing now** → file to `todo`.
- **A human comment resolves the issue** (they answered, unblocked you, or
  confirmed the work is good) → move it to `resolved`. Don't resolve issues
  yourself just because you did more work — only when the loop is actually
  closed.

Only file issues for things that genuinely need a human. Don't use this as
a general-purpose scratchpad or todo list for your own working memory.

## Checking for human replies

Before assuming you're still blocked, or when the user asks "what did I
say about X", read the issue and its comment thread:

```
brian show <id> --json
```

Look at `comments` for entries authored by `me` (the human's default
author in the UI) that postdate your last comment. If a reply resolves
the question or unblocks you, act on it and then `brian move <id> resolved`
(or `brian move <id> done`).

Also check `brian attention --json` (or `brian attention` for a human
skim) at the start of a session or when asked what needs attention — it
lists everything in `needs_attention` or `blocked` with the latest
comment inlined as `latest_comment`. Narrow it to the repo you're in
with `brian attention --project <repo>`.

## Finding an issue you filed earlier

You won't remember the id across sessions. Look it up by project rather
than guessing:

```
brian list --project <repo> --json     # find the issue, read its "id"
brian show <id> --json                 # full description + comment thread
```

`brian list` hides `resolved` issues unless you pass `--all` or an
explicit `--status`. If you only care about open human-in-the-loop
items, `brian attention --project <repo>` is the shorter path.

## Conventions

- Always pass `--project <repo-name>` when filing or editing so issues are
  grouped by repo (use the current repo's directory/folder name).
- Always pass `--author <name>` with a short, identifiable session/agent
  name (e.g. `claude-code`, `agent-session-3`) instead of the default
  `agent`, so a human can tell which run filed what.
- Write descriptions that state: what was done, what you need from the
  human (a decision, a yes/no, credentials, a review), and links or file
  paths relevant to the work. Use markdown; it renders as-is.
- If the work has a GitHub PR or issue, put its full URL in the
  description (not only in a comment). The board shows GitHub links as a
  chip on the card so the human can jump straight to the PR.
- Keep titles short and imperative, e.g. "Review new auth middleware",
  "Need Stripe test key", "Confirm delete-cascade behavior".
- Prefer one issue per discrete question/task. Don't bundle unrelated
  asks into one issue's description.

## Commands you'll use most

```
brian add "<title>" --desc "<markdown>" --status needs_attention --project <repo> --author <name>
brian add "<title>" --desc-file - --status blocked --project <repo> --author <name>   # pipe description via stdin
brian attention --project <repo> --json
brian show <id> --json
brian comment <id> "<reply>" --author <name>
brian move <id> resolved
brian list --project <repo> --json
```

If any command fails because the server isn't reachable, tell the human:
the local brian server isn't running (`bun run start` in the brian repo,
or check the launchd agent), and don't silently drop the update.
