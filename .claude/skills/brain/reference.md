# brain CLI reference

Talks to the local brain HTTP API at `BRAIN_URL` (default
`http://localhost:4400`). Every command supports `--json`, which prints the
raw API response JSON to stdout and nothing else — use it for anything
scripted. Without `--json`, output is a compact human-readable table or
detail view.

Exit codes: `0` success, `1` API/usage error (message on stderr), `2` server
unreachable.

Statuses: `todo`, `needs_attention`, `blocked`, `resolved`.
Aliases accepted anywhere a status is expected: `attention` →
`needs_attention`, `done` → `resolved`.

## brain add

```
brain add <title> [--desc <md>] [--desc-file <path>|-] [--status <s>] [--project <p>] [--author <a>]
```

Creates an issue. `--desc-file -` reads the description from stdin (useful
for multi-line/markdown descriptions piped from a heredoc). `--author`
defaults to `agent`. `--status` defaults to `todo` server-side. Prints
`#<id> <title>` (or the full issue JSON with `--json`).

## brain list

```
brain list [--status <s>] [--project <p>] [--all] [--json]
```

Lists issues, newest-updated first. By default hides `resolved` issues
unless `--status` is explicitly given or `--all` is passed. Table columns:
id, status, project, title, updated.

## brain attention

```
brain attention [--json]
```

Lists issues in `needs_attention` or `blocked`, with an excerpt of the
latest comment on each (non-JSON mode only — `--json` returns the raw
issue array with no comment fetch, for speed).

## brain show

```
brain show <id> [--json]
```

Full issue: title, status, project, author, timestamps, description, and
the full comment thread in order. Markdown is printed as-is (not rendered).

## brain move

```
brain move <id> <status>
```

Updates only the status. Accepts aliases (`attention`, `done`).

## brain edit

```
brain edit <id> [--title <t>] [--desc <md>|--desc-file <path>|-] [--project <p>]
```

Partial update — pass only the fields you want to change. At least one of
`--title`, `--desc`/`--desc-file`, `--project` is required.

## brain comment

```
brain comment <id> <body|-> [--author <a>]
```

Adds a comment. Pass `-` as the body to read it from stdin. `--author`
defaults to `agent`.

## brain rm / brain rm-comment

```
brain rm <id>
brain rm-comment <id>
```

Hard-deletes an issue (cascades its comments) or a single comment.

## brain open

```
brain open
```

Opens the board (`BRAIN_URL`) in the default browser via `open`.

## Environment

- `BRAIN_URL` — base URL of the brain API/web server. Default
  `http://localhost:4400`.

## Examples

```sh
brain add "Review the new auth middleware" \
  --desc "Swapped session cookies for JWT in packages/server/src/auth.ts. Please sanity check expiry handling." \
  --status needs_attention --project brain --author claude-code

echo "Need a Stripe test-mode secret key to finish billing integration." | \
  brain add "Need Stripe test key" --desc-file - --status blocked --project my-app --author claude-code

brain attention --project brain
brain show 12 --json
brain comment 12 "Fixed per your feedback, PTAL" --author claude-code
brain move 12 resolved
```
