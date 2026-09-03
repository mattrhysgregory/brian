import { z } from "zod";

export const STATUSES = ["todo", "needs_attention", "blocked", "resolved"] as const;
export type Status = (typeof STATUSES)[number];
export const StatusSchema = z.enum(STATUSES);

export const STATUS_LABELS: Record<Status, string> = {
  todo: "Todo",
  needs_attention: "Needs attention",
  blocked: "Blocked",
  resolved: "Resolved",
};

export const ATTENTION_STATUSES: readonly Status[] = ["needs_attention", "blocked"];

export const DEFAULT_PORT = 4400;
export const DEFAULT_BASE_URL = `http://localhost:${DEFAULT_PORT}`;

/** Server-side representation. Timestamps are ISO-8601 UTC strings. */
export interface Issue {
  id: number;
  title: string;
  description: string | null; // markdown
  status: Status;
  project: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  issue_id: number;
  author: string;
  body: string; // markdown
  created_at: string;
}

export interface IssueWithComments extends Issue {
  comments: Comment[];
}

export const CreateIssueSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(100_000).nullable().optional(),
  status: StatusSchema.default("todo"),
  project: z.string().trim().max(100).nullable().optional(),
  created_by: z.string().trim().min(1).max(100).default("me"),
});
export type CreateIssue = z.input<typeof CreateIssueSchema>;

export const UpdateIssueSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: z.string().max(100_000).nullable(),
    status: StatusSchema,
    project: z.string().trim().max(100).nullable(),
  })
  .partial();
export type UpdateIssue = z.infer<typeof UpdateIssueSchema>;

export const CreateCommentSchema = z.object({
  author: z.string().trim().min(1).max(100).default("me"),
  body: z.string().trim().min(1).max(100_000),
});
export type CreateComment = z.input<typeof CreateCommentSchema>;

export const ListIssuesQuerySchema = z.object({
  status: StatusSchema.optional(),
  project: z.string().optional(),
});

/** Payload pushed on the SSE stream, event name "changed". */
export interface ChangedEvent {
  kind: "issue" | "comment";
  id: number;
  action: "created" | "updated" | "deleted";
}

export interface ApiError {
  error: string;
}
