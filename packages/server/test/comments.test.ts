import { describe, expect, test } from "bun:test";
import type { Comment } from "@brain/shared";
import { addComment, createIssue, getIssue, makeApp } from "./helpers";

describe("comments", () => {
  test("create returns the comment and bumps the issue updated_at", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app);
    const comment = await addComment(app, issue.id, { author: "agent", body: " hi " });
    expect(comment).toMatchObject({ issue_id: issue.id, author: "agent", body: "hi" });

    const after = await getIssue(app, issue.id);
    expect(after.updated_at > issue.updated_at).toBe(true);
  });

  test("delete removes a comment and bumps the issue", async () => {
    const { app } = makeApp();
    const issue = await createIssue(app);
    const comment = await addComment(app, issue.id);
    const before = await getIssue(app, issue.id);

    const res = await app.request(`/api/comments/${comment.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    const after = await getIssue(app, issue.id);
    expect(after.comments).toEqual([] as Comment[]);
    expect(after.updated_at > before.updated_at).toBe(true);
  });

  test("deleting an issue cascades to its comments", async () => {
    const { db, app } = makeApp();
    const issue = await createIssue(app);
    await addComment(app, issue.id);
    await addComment(app, issue.id);
    expect(db.query("SELECT COUNT(*) as n FROM comments").get()).toEqual({ n: 2 });

    await app.request(`/api/issues/${issue.id}`, { method: "DELETE" });
    expect(db.query("SELECT COUNT(*) as n FROM comments").get()).toEqual({ n: 0 });
  });
});
