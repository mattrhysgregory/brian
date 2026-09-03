import { describe, expect, test } from "bun:test";
import { addComment, createIssue, makeApp } from "./helpers";

describe("DELETE /api/issues?status=", () => {
  test("deletes only issues with the given status and returns the count", async () => {
    const { app } = makeApp();
    await createIssue(app, { title: "a", status: "todo" });
    await createIssue(app, { title: "b", status: "resolved" });
    await createIssue(app, { title: "c", status: "resolved" });

    const res = await app.request("/api/issues?status=resolved", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });

    const remaining = (await (await app.request("/api/issues")).json()) as { title: string }[];
    expect(remaining.map((i) => i.title)).toEqual(["a"]);
  });

  test("cascades comments on the deleted issues", async () => {
    const { app, db } = makeApp();
    const issue = await createIssue(app, { title: "a", status: "resolved" });
    await addComment(app, issue.id, { body: "one" });
    await addComment(app, issue.id, { body: "two" });

    const res = await app.request("/api/issues?status=resolved", { method: "DELETE" });
    expect(await res.json()).toEqual({ deleted: 1 });

    const count = db.query("SELECT COUNT(*) AS n FROM comments").get() as { n: number };
    expect(count.n).toBe(0);
  });

  test("returns deleted: 0 when nothing matches", async () => {
    const { app } = makeApp();
    await createIssue(app, { title: "a", status: "todo" });
    const res = await app.request("/api/issues?status=resolved", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 0 });
  });

  test("400 on missing status", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues", { method: "DELETE" });
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toHaveProperty("error");
  });

  test("400 on unknown status", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues?status=bogus", { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  test("emits a bulk event when something is deleted, none when nothing is", async () => {
    const { app, events } = makeApp();
    await createIssue(app, { title: "a", status: "resolved" });

    await app.request("/api/issues?status=todo", { method: "DELETE" });
    expect(events.filter((e) => e.kind === "bulk")).toHaveLength(0);

    await app.request("/api/issues?status=resolved", { method: "DELETE" });
    expect(events.at(-1)).toEqual({ kind: "bulk", id: 0, action: "deleted" });
  });

  test("does not clash with DELETE /api/issues/:id", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app, { title: "a" });
    const res = await app.request(`/api/issues/${issue.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });
});
