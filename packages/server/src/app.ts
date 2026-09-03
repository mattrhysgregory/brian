import { Hono } from "hono";
import type { Context } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ATTENTION_STATUSES,
  ClearIssuesQuerySchema,
  CreateCommentSchema,
  CreateIssueSchema,
  ListIssuesQuerySchema,
  UpdateIssueSchema,
  type AttentionIssue,
  type ChangedEvent,
  type Comment,
  type Issue,
  type IssueWithComments,
  type Status,
} from "@brian/shared";
import { nowIso, type Db } from "./db";
import { EventBus } from "./events";
import type { Notifier } from "./notify";

export interface AppOptions {
  bus?: EventBus;
  /** Directory holding the built web bundle. Defaults to packages/web/dist. */
  webDist?: string;
  /** Fires macOS notifications when an issue enters needs_attention/blocked. Defaults to a no-op. */
  notify?: Notifier;
}

const ATTENTION_ENTRY_STATUSES = new Set<Status>(["needs_attention", "blocked"]);

const DEFAULT_WEB_DIST = resolve(import.meta.dir, "..", "..", "web", "dist");

/** Structural shape of a zod error, so the server needs no direct zod dependency. */
interface ZodLikeError {
  issues: { path: PropertyKey[]; message: string }[];
}

function firstIssue(err: ZodLikeError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid request";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** True for http(s)://localhost|127.0.0.1 on any port. Unparseable origins are rejected. */
function isLocalOrigin(origin: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Body may be absent or malformed; treat both as an empty object so zod reports the real problem. */
async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

export function createApp(db: Db, options: AppOptions = {}) {
  const bus = options.bus ?? new EventBus();
  const webDist = options.webDist ?? DEFAULT_WEB_DIST;
  const notify = options.notify ?? (() => {});

  const emit = (kind: ChangedEvent["kind"], id: number, action: ChangedEvent["action"]) =>
    bus.emit({ kind, id, action });

  const getIssue = (id: number): Issue | null =>
    (db.query("SELECT issues.*, (SELECT COUNT(*) FROM comments WHERE comments.issue_id = issues.id) AS comment_count FROM issues WHERE id = ?").get(id) as Issue | null) ?? null;

  const listComments = (issueId: number): Comment[] =>
    db
      .query("SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC, id ASC")
      .all(issueId) as Comment[];

  const touchIssue = (id: number) =>
    db.query("UPDATE issues SET updated_at = ? WHERE id = ?").run(nowIso(), id);

  const app = new Hono();

  // Cheap CSRF guard: the server is localhost-only and unauthenticated, so a
  // browser page on another origin must not be able to drive it. Requests with
  // no Origin at all (CLI, curl) are not browser-initiated, so they pass.
  app.use("/api/*", async (c, next) => {
    if (c.req.method === "GET" || c.req.method === "HEAD") return next();
    const origin = c.req.header("origin");
    if (origin && !isLocalOrigin(origin)) return c.json({ error: "forbidden origin" }, 403);
    return next();
  });

  app.get("/api/health", (c) => c.json({ ok: true as const }));

  app.get("/api/issues", (c) => {
    const raw = c.req.query();
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) if (v !== "") cleaned[k] = v;

    const parsed = ListIssuesQuerySchema.safeParse(cleaned);
    if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

    const where: string[] = [];
    const params: unknown[] = [];
    if (parsed.data.status) {
      where.push("status = ?");
      params.push(parsed.data.status);
    }
    if (parsed.data.project) {
      where.push("project = ?");
      params.push(parsed.data.project);
    }
    const sql = `SELECT issues.*, (SELECT COUNT(*) FROM comments WHERE comments.issue_id = issues.id) AS comment_count FROM issues${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC, id DESC`;
    return c.json(db.query(sql).all(...(params as never[])) as Issue[]);
  });

  const latestComment = (issueId: number): Comment | null =>
    (db
      .query("SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at DESC, id DESC LIMIT 1")
      .get(issueId) as Comment | null) ?? null;

  app.get("/api/attention", (c) => {
    const placeholders = ATTENTION_STATUSES.map(() => "?").join(", ");
    const rows = db
      .query(
        `SELECT issues.*, (SELECT COUNT(*) FROM comments WHERE comments.issue_id = issues.id) AS comment_count FROM issues WHERE status IN (${placeholders}) ORDER BY updated_at DESC, id DESC`,
      )
      .all(...(ATTENTION_STATUSES as unknown as never[])) as Issue[];
    // The attention list is tiny (open human-in-the-loop items), so a second
    // query per row is cheaper than a join we'd have to unpack.
    const withComments: AttentionIssue[] = rows.map((issue) => ({
      ...issue,
      latest_comment: latestComment(issue.id),
    }));
    return c.json(withComments);
  });

  app.post("/api/issues", async (c) => {
    const parsed = CreateIssueSchema.safeParse(await readJson(c));
    if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);
    const { title, description, status, project, created_by } = parsed.data;
    const ts = nowIso();
    const { lastInsertRowid } = db
      .query(
        `INSERT INTO issues (title, description, status, project, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(title, description ?? null, status, project ?? null, created_by, ts, ts);
    const id = Number(lastInsertRowid);
    emit("issue", id, "created");
    const created = getIssue(id) as Issue;
    if (ATTENTION_ENTRY_STATUSES.has(created.status)) notify(created);
    return c.json(created, 201);
  });

  app.get("/api/issues/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid issue id" }, 400);
    const issue = getIssue(id);
    if (!issue) return c.json({ error: "Issue not found" }, 404);
    return c.json({ ...issue, comments: listComments(id) } satisfies IssueWithComments);
  });

  app.patch("/api/issues/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid issue id" }, 400);
    if (!getIssue(id)) return c.json({ error: "Issue not found" }, 404);

    const before = getIssue(id) as Issue;
    const parsed = UpdateIssueSchema.safeParse(await readJson(c));
    if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

    const sets: string[] = [];
    const params: unknown[] = [];
    for (const field of ["title", "description", "status", "project"] as const) {
      if (field in parsed.data) {
        sets.push(`${field} = ?`);
        params.push(parsed.data[field] ?? null);
      }
    }
    sets.push("updated_at = ?");
    params.push(nowIso());
    db.query(`UPDATE issues SET ${sets.join(", ")} WHERE id = ?`).run(
      ...(params as never[]),
      id as never,
    );
    emit("issue", id, "updated");
    const updated = getIssue(id) as Issue;
    if (
      updated.status !== before.status &&
      ATTENTION_ENTRY_STATUSES.has(updated.status)
    ) {
      notify(updated);
    }
    return c.json(updated);
  });

  app.delete("/api/issues", (c) => {
    const raw = c.req.query();
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) if (v !== "") cleaned[k] = v;

    const parsed = ClearIssuesQuerySchema.safeParse(cleaned);
    if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

    // `changes` from the DELETE itself would also count comment rows removed
    // by the ON DELETE CASCADE, so count matching issues up front instead.
    const { n: deleted } = db
      .query("SELECT COUNT(*) AS n FROM issues WHERE status = ?")
      .get(parsed.data.status) as { n: number };
    db.query("DELETE FROM issues WHERE status = ?").run(parsed.data.status);
    if (deleted > 0) emit("bulk", 0, "deleted");
    return c.json({ deleted });
  });

  app.delete("/api/issues/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid issue id" }, 400);
    const { changes } = db.query("DELETE FROM issues WHERE id = ?").run(id);
    if (!changes) return c.json({ error: "Issue not found" }, 404);
    emit("issue", id, "deleted");
    return c.body(null, 204);
  });

  app.post("/api/issues/:id/comments", async (c) => {
    const issueId = Number(c.req.param("id"));
    if (!Number.isInteger(issueId)) return c.json({ error: "Invalid issue id" }, 400);
    if (!getIssue(issueId)) return c.json({ error: "Issue not found" }, 404);

    const parsed = CreateCommentSchema.safeParse(await readJson(c));
    if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

    const { lastInsertRowid } = db
      .query("INSERT INTO comments (issue_id, author, body, created_at) VALUES (?, ?, ?, ?)")
      .run(issueId, parsed.data.author, parsed.data.body, nowIso());
    const id = Number(lastInsertRowid);
    // a new comment counts as activity on the issue
    touchIssue(issueId);
    emit("comment", id, "created");
    const comment = db.query("SELECT * FROM comments WHERE id = ?").get(id) as Comment;
    return c.json(comment, 201);
  });

  app.delete("/api/comments/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid comment id" }, 400);
    const row = db.query("SELECT issue_id FROM comments WHERE id = ?").get(id) as
      | { issue_id: number }
      | null;
    if (!row) return c.json({ error: "Comment not found" }, 404);
    db.query("DELETE FROM comments WHERE id = ?").run(id);
    touchIssue(row.issue_id);
    emit("comment", id, "deleted");
    return c.body(null, 204);
  });

  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      let done!: () => void;
      const closed = new Promise<void>((r) => {
        done = r;
      });

      let cleanup!: () => void;

      // A vanished client makes these writes reject; tear the subscriber and
      // the ping interval down rather than leaking them for the process life.
      const unsubscribe = bus.subscribe((event) => {
        void stream
          .writeSSE({ event: "changed", data: JSON.stringify(event) })
          .catch(() => cleanup());
      });
      const ping = setInterval(() => {
        void stream.write(": ping\n\n").catch(() => cleanup());
      }, 25_000);

      let cleaned = false;
      cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        clearInterval(ping);
        unsubscribe();
        done();
      };
      stream.onAbort(cleanup);
      c.req.raw.signal?.addEventListener("abort", cleanup);

      await stream.write(": connected\n\n");
      await closed;
    }),
  );

  // Unknown API routes must stay JSON rather than falling through to the SPA.
  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  const notBuilt = (c: Context) =>
    c.text("brian: the web UI has not been built yet. Run `bun run build` in the repo root.", 503);

  const staticFiles = serveStatic({ root: webDist });
  const spaShell = serveStatic({ root: webDist, path: "index.html" });

  app.use("/*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") return next();
    if (!existsSync(join(webDist, "index.html"))) return notBuilt(c);
    return next();
  });
  app.use("/*", staticFiles);
  // SPA fallback: any other GET renders the shell so client-side routing works.
  app.get("*", async (c) => (await spaShell(c, async () => {})) ?? notBuilt(c));

  return app;
}

export type App = ReturnType<typeof createApp>;
