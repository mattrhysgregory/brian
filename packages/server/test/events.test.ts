import { describe, expect, test } from "bun:test";
import type { ChangedEvent } from "@brian/shared";
import { EventBus } from "../src/events";
import { addComment, createIssue, makeApp } from "./helpers";

describe("event bus", () => {
  test("subscribe / emit / unsubscribe", () => {
    const bus = new EventBus();
    const seen: ChangedEvent[] = [];
    const off = bus.subscribe((e) => seen.push(e));
    bus.emit({ kind: "issue", id: 1, action: "created" });
    expect(bus.size).toBe(1);
    off();
    bus.emit({ kind: "issue", id: 2, action: "updated" });
    expect(bus.size).toBe(0);
    expect(seen).toEqual([{ kind: "issue", id: 1, action: "created" }]);
  });

  test("a throwing subscriber does not break the others", () => {
    const bus = new EventBus();
    const seen: ChangedEvent[] = [];
    bus.subscribe(() => {
      throw new Error("boom");
    });
    bus.subscribe((e) => seen.push(e));
    bus.emit({ kind: "comment", id: 3, action: "deleted" });
    expect(seen).toHaveLength(1);
  });

  test("every mutation emits a changed event", async () => {
    const { app, events } = makeApp();
    const issue = await createIssue(app);
    const comment = await addComment(app, issue.id);
    await app.request(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    await app.request(`/api/comments/${comment.id}`, { method: "DELETE" });
    await app.request(`/api/issues/${issue.id}`, { method: "DELETE" });

    expect(events).toEqual([
      { kind: "issue", id: issue.id, action: "created" },
      { kind: "comment", id: comment.id, action: "created" },
      { kind: "issue", id: issue.id, action: "updated" },
      { kind: "comment", id: comment.id, action: "deleted" },
      { kind: "issue", id: issue.id, action: "deleted" },
    ]);
  });

  test("reads do not emit", async () => {
    const { app, events } = makeApp();
    await app.request("/api/issues");
    await app.request("/api/attention");
    await app.request("/api/health");
    expect(events).toEqual([]);
  });
});

describe("SSE stream", () => {
  test("streams changed events and cleans up on abort", async () => {
    const { app, bus } = makeApp();
    const controller = new AbortController();
    const res = await app.request("/api/events", { signal: controller.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // the priming comment
    expect(decoder.decode((await reader.read()).value)).toContain(": connected");

    await createIssue(app);
    expect(bus.size).toBe(2); // the test collector plus this stream

    let chunk = "";
    while (!chunk.includes("event: changed")) {
      const { value, done } = await reader.read();
      if (done) break;
      chunk += decoder.decode(value);
    }
    expect(chunk).toContain("event: changed");
    expect(chunk).toContain('"kind":"issue"');
    expect(chunk).toContain('"action":"created"');

    await reader.cancel();
    controller.abort();
    await Bun.sleep(20);
    expect(bus.size).toBe(1);
  });
});
