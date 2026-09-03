import { afterEach, describe, expect, test } from "bun:test";
import type { Comment, Issue, IssueWithComments } from "@brain/shared";
import { run } from "../src/cli";

const BASE_URL = "http://localhost:4400";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 1,
    title: "Fix the thing",
    description: null,
    status: "todo",
    project: "brain",
    created_by: "agent",
    created_at: "2026-09-03T10:00:00.000Z",
    updated_at: "2026-09-03T10:00:00.000Z",
    ...overrides,
  };
}

interface Captured {
  calls: { url: string; init: RequestInit | undefined }[];
  stdout: string[];
  stderr: string[];
}

function makeIo(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const captured: Captured = { calls: [], stdout: [], stderr: [] };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    captured.calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;

  const io = {
    baseUrl: BASE_URL,
    stdout: (s: string) => captured.stdout.push(s),
    stderr: (s: string) => captured.stderr.push(s),
    readStdin: async () => "stdin body",
    openUrl: async () => {},
  };
  return { io, captured };
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("brain add", () => {
  test("posts to /api/issues and prints id + title", async () => {
    const issue = makeIssue({ id: 42, title: "New issue" });
    const { io, captured } = makeIo(() => jsonResponse(issue));

    const code = await run(["add", "New issue", "--project", "brain"], io);

    expect(code).toBe(0);
    expect(captured.calls).toHaveLength(1);
    expect(captured.calls[0].url).toBe(`${BASE_URL}/api/issues`);
    expect(captured.calls[0].init?.method).toBe("POST");
    const body = JSON.parse(captured.calls[0].init?.body as string);
    expect(body).toEqual({
      title: "New issue",
      description: null,
      status: undefined,
      project: "brain",
      created_by: "agent",
    });
    expect(captured.stdout).toEqual(["#42 New issue"]);
  });

  test("--json prints raw json", async () => {
    const issue = makeIssue({ id: 7 });
    const { io, captured } = makeIo(() => jsonResponse(issue));
    const code = await run(["add", "Title", "--json"], io);
    expect(code).toBe(0);
    expect(JSON.parse(captured.stdout[0])).toEqual(issue);
  });

  test("respects custom author", async () => {
    const issue = makeIssue();
    const { io, captured } = makeIo(() => jsonResponse(issue));
    await run(["add", "Title", "--author", "claude"], io);
    const body = JSON.parse(captured.calls[0].init?.body as string);
    expect(body.created_by).toBe("claude");
  });
});

describe("brain list", () => {
  test("GET /api/issues, hides resolved by default", async () => {
    const issues = [
      makeIssue({ id: 1, status: "todo" }),
      makeIssue({ id: 2, status: "resolved" }),
    ];
    const { io, captured } = makeIo(() => jsonResponse(issues));
    const code = await run(["list"], io);
    expect(code).toBe(0);
    expect(captured.calls[0].url).toBe(`${BASE_URL}/api/issues`);
    expect(captured.stdout[0]).toContain("#1");
    expect(captured.stdout[0]).not.toContain("#2");
  });

  test("--all shows resolved too", async () => {
    const issues = [makeIssue({ id: 1, status: "todo" }), makeIssue({ id: 2, status: "resolved" })];
    const { io, captured } = makeIo(() => jsonResponse(issues));
    await run(["list", "--all"], io);
    expect(captured.stdout[0]).toContain("#1");
    expect(captured.stdout[0]).toContain("#2");
  });

  test("--status filters via query param", async () => {
    const { io, captured } = makeIo(() => jsonResponse([]));
    await run(["list", "--status", "blocked"], io);
    expect(captured.calls[0].url).toBe(`${BASE_URL}/api/issues?status=blocked`);
  });

  test("--json prints raw array", async () => {
    const issues = [makeIssue({ id: 1 })];
    const { io, captured } = makeIo(() => jsonResponse(issues));
    await run(["list", "--json"], io);
    expect(JSON.parse(captured.stdout[0])).toEqual(issues);
  });
});

describe("brain attention", () => {
  test("fetches attention issues and latest comment per issue", async () => {
    const issues = [makeIssue({ id: 5, status: "blocked" })];
    const comment: Comment = {
      id: 1,
      issue_id: 5,
      author: "me",
      body: "please clarify the requirements",
      created_at: "2026-09-03T11:00:00.000Z",
    };
    const detail: IssueWithComments = { ...issues[0], comments: [comment] };

    const { io, captured } = makeIo((url) => {
      if (url.endsWith("/api/attention")) return jsonResponse(issues);
      if (url.endsWith("/api/issues/5")) return jsonResponse(detail);
      throw new Error(`unexpected url ${url}`);
    });

    const code = await run(["attention"], io);
    expect(code).toBe(0);
    expect(captured.stdout[0]).toContain("#5");
    expect(captured.stdout[0]).toContain("please clarify");
  });

  test("--json skips fetching comments", async () => {
    const issues = [makeIssue({ id: 5, status: "blocked" })];
    const { io, captured } = makeIo(() => jsonResponse(issues));
    await run(["attention", "--json"], io);
    expect(captured.calls).toHaveLength(1);
    expect(JSON.parse(captured.stdout[0])).toEqual(issues);
  });
});

describe("brain move", () => {
  test("PATCHes status, accepts aliases", async () => {
    const issue = makeIssue({ id: 3, status: "needs_attention" });
    const { io, captured } = makeIo(() => jsonResponse(issue));
    const code = await run(["move", "3", "attention"], io);
    expect(code).toBe(0);
    expect(captured.calls[0].url).toBe(`${BASE_URL}/api/issues/3`);
    expect(captured.calls[0].init?.method).toBe("PATCH");
    const body = JSON.parse(captured.calls[0].init?.body as string);
    expect(body).toEqual({ status: "needs_attention" });
    expect(captured.stdout[0]).toBe("#3 -> needs_attention");
  });

  test("done aliases to resolved", async () => {
    const issue = makeIssue({ id: 3, status: "resolved" });
    const { io, captured } = makeIo(() => jsonResponse(issue));
    await run(["move", "3", "done"], io);
    const body = JSON.parse(captured.calls[0].init?.body as string);
    expect(body.status).toBe("resolved");
  });

  test("unknown status is a usage error, exit 1", async () => {
    const { io, captured } = makeIo(() => jsonResponse({}));
    const code = await run(["move", "3", "bogus"], io);
    expect(code).toBe(1);
    expect(captured.stderr[0]).toContain("unknown status");
  });
});

describe("brain comment", () => {
  test("posts comment body", async () => {
    const comment: Comment = {
      id: 9,
      issue_id: 3,
      author: "agent",
      body: "done",
      created_at: "2026-09-03T10:00:00.000Z",
    };
    const { io, captured } = makeIo(() => jsonResponse(comment));
    const code = await run(["comment", "3", "done"], io);
    expect(code).toBe(0);
    expect(captured.calls[0].url).toBe(`${BASE_URL}/api/issues/3/comments`);
    const body = JSON.parse(captured.calls[0].init?.body as string);
    expect(body).toEqual({ body: "done", author: "agent" });
    expect(captured.stdout[0]).toBe("comment #9 added to #3");
  });

  test("reads body from stdin when arg is -", async () => {
    const comment: Comment = {
      id: 10,
      issue_id: 3,
      author: "agent",
      body: "stdin body",
      created_at: "2026-09-03T10:00:00.000Z",
    };
    const { io, captured } = makeIo(() => jsonResponse(comment));
    await run(["comment", "3", "-"], io);
    const body = JSON.parse(captured.calls[0].init?.body as string);
    expect(body.body).toBe("stdin body");
  });
});

describe("unreachable server", () => {
  test("prints clear stderr message and exits 2", async () => {
    const { io, captured } = makeIo(() => {
      throw new Error("connection refused");
    });
    globalThis.fetch = (async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;

    const code = await run(["list"], io);
    expect(code).toBe(2);
    expect(captured.stderr[0]).toBe(
      `brain: server not running at ${BASE_URL} (start it with: bun run start in <repo>, or check launchd)`,
    );
  });
});

describe("api errors", () => {
  test("exits 1 with the error message from the server", async () => {
    const { io, captured } = makeIo(() => jsonResponse({ error: "title is too long" }, 400));
    const code = await run(["add", "Some title"], io);
    expect(code).toBe(1);
    expect(captured.stderr[0]).toBe("brain: title is too long");
  });

  test("propagates non-2xx error message", async () => {
    const { io, captured } = makeIo(() => jsonResponse({ error: "issue not found" }, 404));
    const code = await run(["show", "999"], io);
    expect(code).toBe(1);
    expect(captured.stderr[0]).toBe("brain: issue not found");
  });
});
