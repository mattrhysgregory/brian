import { describe, expect, test } from "bun:test";
import { createNotifier } from "../src/notify";
import { addComment, createIssue, makeApp } from "./helpers";
import type { Issue } from "@brain/shared";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 1,
    title: "Fix the thing",
    description: null,
    status: "todo",
    project: null,
    created_by: "agent",
    created_at: "2026-09-03T10:00:00.000Z",
    updated_at: "2026-09-03T10:00:00.000Z",
    comment_count: 0,
    ...overrides,
  };
}

describe("createNotifier", () => {
  test("runs osascript for needs_attention and blocked, on darwin, when enabled", () => {
    const calls: string[][] = [];
    const notify = createNotifier({ enabled: true, platform: "darwin", run: (cmd) => calls.push(cmd) });
    notify(makeIssue({ id: 5, title: "Blocked one", status: "blocked" }));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("osascript");
    expect(calls[0]).toContain("#5 Blocked one");
    expect(calls[0]).toContain("Blocked");
  });

  test("includes project in the subtitle when present", () => {
    const calls: string[][] = [];
    const notify = createNotifier({ enabled: true, platform: "darwin", run: (cmd) => calls.push(cmd) });
    notify(makeIssue({ id: 6, status: "needs_attention", project: "brain" }));
    expect(calls[0]).toContain("Needs attention · brain");
  });

  test("does not fire for todo or resolved", () => {
    const calls: string[][] = [];
    const notify = createNotifier({ enabled: true, platform: "darwin", run: (cmd) => calls.push(cmd) });
    notify(makeIssue({ status: "todo" }));
    notify(makeIssue({ status: "resolved" }));
    expect(calls).toHaveLength(0);
  });

  test("does not fire when disabled", () => {
    const calls: string[][] = [];
    const notify = createNotifier({ enabled: false, platform: "darwin", run: (cmd) => calls.push(cmd) });
    notify(makeIssue({ status: "blocked" }));
    expect(calls).toHaveLength(0);
  });

  test("does not fire off-darwin", () => {
    const calls: string[][] = [];
    const notify = createNotifier({ enabled: true, platform: "linux", run: (cmd) => calls.push(cmd) });
    notify(makeIssue({ status: "blocked" }));
    expect(calls).toHaveLength(0);
  });

  test("never throws even if run throws", () => {
    const notify = createNotifier({
      enabled: true,
      platform: "darwin",
      run: () => {
        throw new Error("boom");
      },
    });
    expect(() => notify(makeIssue({ status: "blocked" }))).not.toThrow();
  });

  test("titles/projects with quotes and backslashes are passed through argv, not interpolated", () => {
    const calls: string[][] = [];
    const notify = createNotifier({ enabled: true, platform: "darwin", run: (cmd) => calls.push(cmd) });
    notify(
      makeIssue({
        id: 7,
        title: `weird " title \\ here`,
        status: "blocked",
        project: `proj"ect`,
      }),
    );
    expect(calls[0]).toContain(`#7 weird " title \\ here`);
    expect(calls[0]).toContain(`Blocked · proj"ect`);
  });
});

describe("notify wiring in createApp", () => {
  test("fires on create with attention status", async () => {
    const { app, notified } = makeApp();
    await createIssue(app, { title: "a", status: "blocked" });
    expect(notified).toHaveLength(1);
    expect(notified[0].status).toBe("blocked");
  });

  test("does not fire on create with todo", async () => {
    const { app, notified } = makeApp();
    await createIssue(app, { title: "a", status: "todo" });
    expect(notified).toHaveLength(0);
  });

  test("fires on PATCH transitioning into needs_attention", async () => {
    const { app, notified } = makeApp();
    const issue = await createIssue(app, { title: "a", status: "todo" });
    await app.request(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "needs_attention" }),
    });
    expect(notified).toHaveLength(1);
    expect(notified[0].status).toBe("needs_attention");
  });

  test("fires on PATCH transitioning into blocked", async () => {
    const { app, notified } = makeApp();
    const issue = await createIssue(app, { title: "a", status: "todo" });
    await app.request(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "blocked" }),
    });
    expect(notified).toHaveLength(1);
  });

  test("does not fire on PATCH staying in the same attention status", async () => {
    const { app, notified } = makeApp();
    const issue = await createIssue(app, { title: "a", status: "blocked" });
    notified.length = 0;
    await app.request(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "still blocked" }),
    });
    expect(notified).toHaveLength(0);
  });

  test("does not fire on PATCH moving to todo or resolved", async () => {
    const { app, notified } = makeApp();
    const issue = await createIssue(app, { title: "a", status: "blocked" });
    notified.length = 0;
    await app.request(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    expect(notified).toHaveLength(0);
  });

  test("does not fire on comments", async () => {
    const { app, notified } = makeApp();
    const issue = await createIssue(app, { title: "a", status: "blocked" });
    notified.length = 0;
    await addComment(app, issue.id, { body: "hi" });
    expect(notified).toHaveLength(0);
  });
});
