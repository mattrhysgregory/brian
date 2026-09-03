import { createApp } from "../src/app";
import { createDb } from "../src/db";
import { EventBus } from "../src/events";
import type { ChangedEvent, Comment, Issue, IssueWithComments } from "@brain/shared";

export function makeApp() {
  const db = createDb(":memory:");
  const bus = new EventBus();
  const events: ChangedEvent[] = [];
  bus.subscribe((e) => events.push(e));
  const notified: Issue[] = [];
  const app = createApp(db, {
    bus,
    webDist: "/nonexistent-web-dist",
    notify: (issue) => notified.push(issue),
  });
  return { db, bus, events, notified, app };
}

export type Api = ReturnType<typeof makeApp>["app"];

export async function createIssue(
  app: Api,
  body: Record<string, unknown> = { title: "hello" },
): Promise<Issue> {
  const res = await app.request("/api/issues", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status !== 201) throw new Error(`create failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Issue;
}

export async function addComment(
  app: Api,
  issueId: number,
  body: Record<string, unknown> = { body: "a comment" },
): Promise<Comment> {
  const res = await app.request(`/api/issues/${issueId}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status !== 201) throw new Error(`comment failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Comment;
}

export async function getIssue(app: Api, id: number): Promise<IssueWithComments> {
  const res = await app.request(`/api/issues/${id}`);
  return (await res.json()) as IssueWithComments;
}

export function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
