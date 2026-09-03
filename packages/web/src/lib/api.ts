import type {
  ClearResult,
  Comment,
  CreateComment,
  CreateIssue,
  Issue,
  IssueWithComments,
  Status,
  UpdateIssue,
} from "@brain/shared";

/**
 * All requests are same-origin: in production the Bun server serves both the
 * bundle and `/api`; in dev Vite proxies `/api` to http://localhost:4400.
 */
const BASE = "/api";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: init?.body ? { "content-type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch {
    throw new ApiRequestError(0, "Cannot reach the brain server.");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiRequestError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ListIssuesParams {
  status?: Status;
  project?: string;
}

export const api = {
  listIssues(params: ListIssuesParams = {}): Promise<Issue[]> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.project) qs.set("project", params.project);
    const q = qs.toString();
    return request<Issue[]>(`/issues${q ? `?${q}` : ""}`);
  },

  getIssue(id: number): Promise<IssueWithComments> {
    return request<IssueWithComments>(`/issues/${id}`);
  },

  createIssue(input: CreateIssue): Promise<Issue> {
    return request<Issue>("/issues", { method: "POST", body: JSON.stringify(input) });
  },

  updateIssue(id: number, patch: UpdateIssue): Promise<Issue> {
    return request<Issue>(`/issues/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  deleteIssue(id: number): Promise<void> {
    return request<void>(`/issues/${id}`, { method: "DELETE" });
  },

  /** Deletes every issue in a column. Returns how many rows went. */
  clearIssues(status: Status): Promise<ClearResult> {
    return request<ClearResult>(`/issues?status=${encodeURIComponent(status)}`, {
      method: "DELETE",
    });
  },

  addComment(issueId: number, input: CreateComment): Promise<Comment> {
    return request<Comment>(`/issues/${issueId}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  deleteComment(id: number): Promise<void> {
    return request<void>(`/comments/${id}`, { method: "DELETE" });
  },
};

export const queryKeys = {
  issues: (params: ListIssuesParams = {}) => ["issues", params] as const,
  issue: (id: number) => ["issue", id] as const,
};
