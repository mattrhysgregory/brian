import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type Db = Database;

/** Default on-disk location, overridable with BRIAN_DB. */
export function defaultDbPath(): string {
  return process.env.BRIAN_DB ?? join(homedir(), ".brian", "brian.db");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS issues (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL CHECK (status IN ('todo', 'needs_attention', 'blocked', 'resolved')),
  project     TEXT,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id   INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_issues_status     ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_updated_at ON issues(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON comments(issue_id);
`;

/**
 * Open (or create) the database and apply the schema idempotently.
 * Pass ":memory:" for tests.
 */
export function createDb(path: string = defaultDbPath()): Db {
  if (path !== ":memory:" && !path.startsWith("file::memory:")) {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

let lastNow = 0;

/**
 * ISO-8601 UTC timestamp that is strictly increasing within this process, so
 * `ORDER BY updated_at DESC` is stable even for mutations in the same millisecond.
 */
export function nowIso(): string {
  const t = Math.max(Date.now(), lastNow + 1);
  lastNow = t;
  return new Date(t).toISOString();
}
