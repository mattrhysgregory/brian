import { describe, expect, test } from "bun:test";
import { createIssue, json, makeApp } from "./helpers";

describe("validation and not-found", () => {
  test("400 on missing title", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues", json({}));
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toHaveProperty("error");
  });

  test("400 on blank title", async () => {
    const { app } = makeApp();
    expect((await app.request("/api/issues", json({ title: "   " }))).status).toBe(400);
  });

  test("400 on unknown status", async () => {
    const { app } = makeApp();
    expect((await app.request("/api/issues", json({ title: "x", status: "nope" }))).status).toBe(
      400,
    );
    const issue = await createIssue(app);
    const patch = await app.request(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "nope" }),
    });
    expect(patch.status).toBe(400);
  });

  test("400 on unknown list status filter", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues?status=bogus");
    expect(res.status).toBe(400);
  });

  test("400 on malformed json body", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
  });

  test("400 on empty comment body", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app);
    const res = await app.request(`/api/issues/${issue.id}/comments`, json({ body: "  " }));
    expect(res.status).toBe(400);
  });

  test("404s", async () => {
    const { app } = makeApp();
    expect((await app.request("/api/issues/999")).status).toBe(404);
    expect((await app.request("/api/issues/999", { method: "DELETE" })).status).toBe(404);
    expect(
      (
        await app.request("/api/issues/999", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(404);
    expect((await app.request("/api/issues/999/comments", json({ body: "x" }))).status).toBe(404);
    expect((await app.request("/api/comments/999", { method: "DELETE" })).status).toBe(404);

    const unknown = await app.request("/api/nope");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "Not found" });
  });

  test("non-api GET without a built bundle returns a plain-text hint", async () => {
    const { app } = makeApp();
    const res = await app.request("/board");
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("bun run build");
  });
});
