import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../src/app";
import { createDb } from "../src/db";

const dist = mkdtempSync(join(tmpdir(), "brian-dist-"));
mkdirSync(join(dist, "assets"), { recursive: true });
writeFileSync(join(dist, "index.html"), "<html>brian shell</html>");
writeFileSync(join(dist, "assets", "app.js"), "console.log(1)");

afterAll(() => rmSync(dist, { recursive: true, force: true }));

const app = createApp(createDb(":memory:"), { webDist: dist });

describe("static serving", () => {
  test("serves real files from web/dist", async () => {
    const res = await app.request("/assets/app.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toBe("console.log(1)");
  });

  test("serves index.html at the root", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("brian shell");
  });

  test("falls back to the SPA shell for unknown client routes", async () => {
    const res = await app.request("/issues/42");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("brian shell");
  });

  test("api routes are not shadowed by the SPA fallback", async () => {
    expect((await app.request("/api/health")).status).toBe(200);
    const missing = await app.request("/api/nope");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Not found" });
  });
});
