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

describe("invalid ids", () => {
  test("PATCH /api/issues/null is a 400", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues/null", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toEqual({ error: "Invalid issue id" });
  });

  test("PATCH /api/issues/abc is a 400", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues/abc", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toEqual({ error: "Invalid issue id" });
  });
});

describe("origin guard", () => {
  test("rejects a non-local Origin on writes", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example.com" },
      body: JSON.stringify({ title: "csrf" }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()) as { error: string }).toEqual({ error: "forbidden origin" });
    expect(((await (await app.request("/api/issues")).json()) as unknown[]).length).toBe(0);
  });

  test("allows localhost and 127.0.0.1 origins on any port", async () => {
    const { app } = makeApp();
    for (const origin of ["http://localhost:4400", "http://127.0.0.1:5173", "http://localhost"]) {
      const res = await app.request("/api/issues", {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ title: `from ${origin}` }),
      });
      expect(res.status).toBe(201);
    }
  });

  test("allows requests with no Origin header (CLI, curl)", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues", json({ title: "from the cli" }));
    expect(res.status).toBe(201);
  });

  test("GET requests are never blocked by origin", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/issues", { headers: { origin: "https://evil.example.com" } });
    expect(res.status).toBe(200);
  });

  test("DELETE from a foreign origin is rejected", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app);
    const res = await app.request(`/api/issues/${issue.id}`, {
      method: "DELETE",
      headers: { origin: "https://evil.example.com" },
    });
    expect(res.status).toBe(403);
    expect((await app.request(`/api/issues/${issue.id}`)).status).toBe(200);
  });
});
