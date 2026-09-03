# brain

Local Kanban for human-in-the-loop tracking of agent work. Bun workspace. See docs/PLAN.md for decisions and the API contract.

- `packages/shared` is the contract (types + zod). Change it deliberately and update server, web and cli together.
- Server: Hono on Bun, `bun:sqlite`, DB at `~/.brain/brain.db`. `bun run start`.
- Web: Vite + React + Tailwind + shadcn + dnd-kit + Lexical. `bun run --filter @brain/web dev` proxies /api to :4400.
- CLI: `brain` (packages/cli). Skill: `.claude/skills/brain`.
- Tests: `bun test`. Typecheck: `bun run typecheck`.
- Use `~/.bun/bin/bun` (1.4+).
