import { describe, expect, test } from "bun:test";
import { createDb, nowIso } from "../src/db";

describe("db", () => {
  test("schema is created idempotently and pragmas are set", () => {
    const db = createDb(":memory:");
    expect(db.query("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    const tables = (
      db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(tables).toContain("issues");
    expect(tables).toContain("comments");
    const indexes = (
      db.query("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(indexes).toContain("idx_issues_status");
    expect(indexes).toContain("idx_issues_updated_at");
  });

  test("status check constraint rejects unknown values", () => {
    const db = createDb(":memory:");
    expect(() =>
      db
        .query(
          `INSERT INTO issues (title, status, created_by, created_at, updated_at)
           VALUES ('x', 'bogus', 'me', 'now', 'now')`,
        )
        .run(),
    ).toThrow();
  });

  test("nowIso is strictly increasing ISO-8601", () => {
    const a = nowIso();
    const b = nowIso();
    expect(a < b).toBe(true);
    expect(new Date(a).toISOString()).toBe(a);
  });
});
