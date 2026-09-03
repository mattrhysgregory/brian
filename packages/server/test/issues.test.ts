import { describe, expect, test } from "bun:test";
import type { AttentionIssue, Issue } from "@brian/shared";
import { addComment, createIssue, getIssue, makeApp } from "./helpers";

describe("issues", () => {
  test("health", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("create applies defaults and returns 201", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app, { title: "  first  " });
    expect(issue.id).toBe(1);
    expect(issue.title).toBe("first");
    expect(issue.description).toBeNull();
    expect(issue.project).toBeNull();
    expect(issue.status).toBe("todo");
    expect(issue.created_by).toBe("me");
    expect(issue.created_at).toBe(issue.updated_at);
  });

  test("create honours supplied fields", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app, {
      title: "deploy",
      description: "# md",
      status: "blocked",
      project: "brian",
      created_by: "agent",
    });
    expect(issue).toMatchObject({
      title: "deploy",
      description: "# md",
      status: "blocked",
      project: "brian",
      created_by: "agent",
    });
  });

  test("get returns the issue with its comments", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app);
    await addComment(app, issue.id, { author: "agent", body: "one" });
    await addComment(app, issue.id, { body: "two" });

    const full = await getIssue(app, issue.id);
    expect(full.id).toBe(issue.id);
    expect(full.comments.map((c) => c.body)).toEqual(["one", "two"]);
    expect(full.comments[0]!.author).toBe("agent");
    expect(full.comments[1]!.author).toBe("me");
  });

  test("list filters by status and project", async () => {
    const { app } = makeApp();
    await createIssue(app, { title: "a", status: "todo", project: "x" });
    await createIssue(app, { title: "b", status: "blocked", project: "x" });
    await createIssue(app, { title: "c", status: "blocked", project: "y" });

    const all = (await (await app.request("/api/issues")).json()) as Issue[];
    expect(all).toHaveLength(3);

    const blocked = (await (await app.request("/api/issues?status=blocked")).json()) as Issue[];
    expect(blocked.map((i) => i.title).sort()).toEqual(["b", "c"]);

    const x = (await (await app.request("/api/issues?project=x")).json()) as Issue[];
    expect(x.map((i) => i.title).sort()).toEqual(["a", "b"]);

    const both = (await (
      await app.request("/api/issues?status=blocked&project=y")
    ).json()) as Issue[];
    expect(both.map((i) => i.title)).toEqual(["c"]);

    // empty query params behave as absent
    const empty = (await (await app.request("/api/issues?status=&project=")).json()) as Issue[];
    expect(empty).toHaveLength(3);
  });

  test("list is ordered by updated_at desc", async () => {
    const { app } = makeApp();
    const a = await createIssue(app, { title: "a" });
    const b = await createIssue(app, { title: "b" });
    const c = await createIssue(app, { title: "c" });

    let list = (await (await app.request("/api/issues")).json()) as Issue[];
    expect(list.map((i) => i.title)).toEqual(["c", "b", "a"]);

    await app.request(`/api/issues/${a.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "blocked" }),
    });

    list = (await (await app.request("/api/issues")).json()) as Issue[];
    expect(list.map((i) => i.title)).toEqual(["a", "c", "b"]);
    expect(b.id).toBeGreaterThan(0);
    expect(c.id).toBeGreaterThan(0);
  });

  test("patch updates fields and bumps updated_at", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app, { title: "old", description: "d" });

    const res = await app.request(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "new", description: null, status: "resolved" }),
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as Issue;
    expect(updated.title).toBe("new");
    expect(updated.description).toBeNull();
    expect(updated.status).toBe("resolved");
    expect(updated.created_at).toBe(issue.created_at);
    expect(updated.updated_at > issue.updated_at).toBe(true);
  });

  test("empty patch still bumps updated_at", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app);
    const res = await app.request(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const updated = (await res.json()) as Issue;
    expect(updated.updated_at > issue.updated_at).toBe(true);
  });

  test("delete removes the issue", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app);
    const res = await app.request(`/api/issues/${issue.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect((await app.request(`/api/issues/${issue.id}`)).status).toBe(404);
  });

  test("attention returns needs_attention and blocked, newest activity first", async () => {
    const { app } = makeApp();
    await createIssue(app, { title: "t", status: "todo" });
    const na = await createIssue(app, { title: "na", status: "needs_attention" });
    await createIssue(app, { title: "bl", status: "blocked" });
    await createIssue(app, { title: "rs", status: "resolved" });

    let rows = (await (await app.request("/api/attention")).json()) as AttentionIssue[];
    expect(rows.map((i) => i.title)).toEqual(["bl", "na"]);

    await addComment(app, na.id);
    rows = (await (await app.request("/api/attention")).json()) as AttentionIssue[];
    expect(rows.map((i) => i.title)).toEqual(["na", "bl"]);
  });

  test("attention inlines the latest comment per issue", async () => {
    const { app } = makeApp();
    const na = await createIssue(app, { title: "na", status: "needs_attention" });
    const bl = await createIssue(app, { title: "bl", status: "blocked" });

    await addComment(app, na.id, { body: "first", author: "me" });
    const newest = await addComment(app, na.id, { body: "second", author: "me" });

    const rows = (await (await app.request("/api/attention")).json()) as AttentionIssue[];
    const byId = new Map(rows.map((i) => [i.id, i]));

    expect(byId.get(na.id)?.latest_comment?.id).toBe(newest.id);
    expect(byId.get(na.id)?.latest_comment?.body).toBe("second");
    expect(byId.get(na.id)?.comment_count).toBe(2);
    // an issue with no comments still carries the field, as null
    expect(byId.get(bl.id)?.latest_comment).toBeNull();
  });
});
