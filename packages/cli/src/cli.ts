import { DEFAULT_BASE_URL } from "@brian/shared";
import type { AttentionIssue, ClearResult, Comment, Issue, IssueWithComments, Status } from "@brian/shared";
import { ApiRequestError, ServerUnreachableError, apiRequest } from "./api";
import { formatAttention, formatIssueDetail, formatIssueList } from "./format";

export interface CliIO {
  baseUrl: string;
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  readStdin: () => Promise<string>;
  openUrl: (url: string) => Promise<void>;
}

const STATUS_ALIASES: Record<string, Status> = {
  todo: "todo",
  attention: "needs_attention",
  needs_attention: "needs_attention",
  blocked: "blocked",
  done: "resolved",
  resolved: "resolved",
};

function resolveStatus(input: string): Status {
  const status = STATUS_ALIASES[input];
  if (!status) {
    throw new UsageError(
      `unknown status "${input}" (expected one of: todo, needs_attention/attention, blocked, resolved/done)`,
    );
  }
  return status;
}

class UsageError extends Error {}

interface ParsedArgs {
  positional: string[];
  flags: Map<string, string | boolean>;
}

/**
 * Flags that always take the next token as their value, even when that token
 * itself starts with "--" (markdown descriptions legitimately begin with ---).
 */
const VALUE_FLAGS = new Set(["desc", "desc-file", "status", "project", "author", "title"]);

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      flags.set(body.slice(0, eq), body.slice(eq + 1));
      continue;
    }
    const next = argv[i + 1];
    if (VALUE_FLAGS.has(body)) {
      if (next === undefined) {
        throw new UsageError(`--${body} requires a value`);
      }
      flags.set(body, next);
      i++;
    } else if (next !== undefined && !next.startsWith("--")) {
      flags.set(body, next);
      i++;
    } else {
      flags.set(body, true);
    }
  }
  return { positional, flags };
}

function flagStr(flags: Map<string, string | boolean>, key: string): string | undefined {
  const v = flags.get(key);
  return typeof v === "string" ? v : undefined;
}

const USAGE = `brian — tiny local kanban CLI

Usage:
  brian add <title> [--desc <md>] [--desc-file <path>|-] [--status <s>] [--project <p>] [--author <a>]
  brian list [--status <s>] [--project <p>] [--all] [--json]
  brian attention [--project <p>] [--json]
  brian show <id> [--json]
  brian move <id> <status>
  brian clear <status> [--json]
  brian edit <id> [--title <t>] [--desc <md>|--desc-file <path>|-] [--project <p>]
  brian comment <id> <body|-> [--author <a>]
  brian rm <id>
  brian rm-comment <id>
  brian open
  brian --help

Statuses: todo, needs_attention (alias attention), blocked, resolved (alias done)
Env: BRIAN_URL (default ${DEFAULT_BASE_URL})
`;

async function resolveDescription(
  io: CliIO,
  flags: Map<string, string | boolean>,
): Promise<string | undefined> {
  const desc = flagStr(flags, "desc");
  if (desc !== undefined) return desc;
  const descFile = flags.get("desc-file");
  if (descFile === true) {
    throw new UsageError("--desc-file requires a path or -");
  }
  if (typeof descFile === "string") {
    if (descFile === "-") return await io.readStdin();
    return await Bun.file(descFile).text();
  }
  return undefined;
}

export async function run(argv: string[], io: CliIO): Promise<number> {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    io.stdout(USAGE.trimEnd());
    return cmd ? 0 : 0;
  }

  try {
    // Inside the try so a malformed flag surfaces as a usage error, not a crash.
    const { positional, flags } = parseArgs(rest);
    const json = flags.get("json") === true;

    switch (cmd) {
      case "add": {
        const title = positional[0];
        if (!title) throw new UsageError("brian add <title>");
        const description = await resolveDescription(io, flags);
        const status = flagStr(flags, "status") ? resolveStatus(flagStr(flags, "status")!) : undefined;
        const project = flagStr(flags, "project");
        const author = flagStr(flags, "author") ?? "agent";
        const issue = await apiRequest<Issue>(io.baseUrl, "/api/issues", {
          method: "POST",
          body: {
            title,
            description: description || null,
            status,
            project: project || null,
            created_by: author,
          },
        });
        if (json) io.stdout(JSON.stringify(issue));
        else io.stdout(`#${issue.id} ${issue.title}`);
        return 0;
      }

      case "list": {
        const status = flagStr(flags, "status") ? resolveStatus(flagStr(flags, "status")!) : undefined;
        const project = flagStr(flags, "project");
        const showAll = flags.get("all") === true;
        let issues = await apiRequest<Issue[]>(io.baseUrl, "/api/issues", {
          query: { status, project },
        });
        if (!showAll && !status) issues = issues.filter((i) => i.status !== "resolved");
        if (json) io.stdout(JSON.stringify(issues));
        else io.stdout(formatIssueList(issues));
        return 0;
      }

      case "attention": {
        let issues = await apiRequest<AttentionIssue[]>(io.baseUrl, "/api/attention");
        // /api/attention takes no filters, so narrow by project client-side.
        const project = flagStr(flags, "project");
        if (project) issues = issues.filter((i) => i.project === project);
        if (json) {
          io.stdout(JSON.stringify(issues));
          return 0;
        }
        const latestComments = new Map<number, Comment | null>(
          issues.map((i) => [i.id, i.latest_comment ?? null]),
        );
        io.stdout(formatAttention(issues, latestComments));
        return 0;
      }

      case "show": {
        const id = positional[0];
        if (!id) throw new UsageError("brian show <id>");
        const issue = await apiRequest<IssueWithComments>(io.baseUrl, `/api/issues/${id}`);
        if (json) io.stdout(JSON.stringify(issue));
        else io.stdout(formatIssueDetail(issue));
        return 0;
      }

      case "move": {
        const id = positional[0];
        const statusInput = positional[1];
        if (!id || !statusInput) throw new UsageError("brian move <id> <status>");
        const status = resolveStatus(statusInput);
        const issue = await apiRequest<Issue>(io.baseUrl, `/api/issues/${id}`, {
          method: "PATCH",
          body: { status },
        });
        if (json) io.stdout(JSON.stringify(issue));
        else io.stdout(`#${issue.id} -> ${issue.status}`);
        return 0;
      }

      case "clear": {
        const statusInput = positional[0];
        if (!statusInput) throw new UsageError("brian clear <status>");
        const status = resolveStatus(statusInput);
        const result = await apiRequest<ClearResult>(io.baseUrl, "/api/issues", {
          method: "DELETE",
          query: { status },
        });
        if (json) io.stdout(JSON.stringify(result));
        else io.stdout(`deleted ${result.deleted} issue(s) from ${status}`);
        return 0;
      }

      case "edit": {
        const id = positional[0];
        if (!id) throw new UsageError("brian edit <id>");
        const body: Record<string, unknown> = {};
        const title = flagStr(flags, "title");
        if (title !== undefined) body.title = title;
        const description = await resolveDescription(io, flags);
        if (description !== undefined) body.description = description || null;
        const project = flagStr(flags, "project");
        // An explicitly empty --project clears it, matching the web UI.
        if (project !== undefined) body.project = project || null;
        if (Object.keys(body).length === 0) {
          throw new UsageError("brian edit <id> requires at least one of --title --desc/--desc-file --project");
        }
        const issue = await apiRequest<Issue>(io.baseUrl, `/api/issues/${id}`, {
          method: "PATCH",
          body,
        });
        if (json) io.stdout(JSON.stringify(issue));
        else io.stdout(`#${issue.id} updated`);
        return 0;
      }

      case "comment": {
        const id = positional[0];
        const bodyArg = positional[1];
        if (!id || bodyArg === undefined) throw new UsageError("brian comment <id> <body|->");
        const body = bodyArg === "-" ? await io.readStdin() : bodyArg;
        const author = flagStr(flags, "author") ?? "agent";
        const comment = await apiRequest<Comment>(io.baseUrl, `/api/issues/${id}/comments`, {
          method: "POST",
          body: { body, author },
        });
        if (json) io.stdout(JSON.stringify(comment));
        else io.stdout(`comment #${comment.id} added to #${id}`);
        return 0;
      }

      case "rm": {
        const id = positional[0];
        if (!id) throw new UsageError("brian rm <id>");
        await apiRequest<void>(io.baseUrl, `/api/issues/${id}`, { method: "DELETE" });
        if (json) io.stdout(JSON.stringify({ ok: true }));
        else io.stdout(`#${id} deleted`);
        return 0;
      }

      case "rm-comment": {
        const id = positional[0];
        if (!id) throw new UsageError("brian rm-comment <id>");
        await apiRequest<void>(io.baseUrl, `/api/comments/${id}`, { method: "DELETE" });
        if (json) io.stdout(JSON.stringify({ ok: true }));
        else io.stdout(`comment #${id} deleted`);
        return 0;
      }

      case "open": {
        await io.openUrl(io.baseUrl);
        if (json) io.stdout(JSON.stringify({ ok: true, url: io.baseUrl }));
        else io.stdout(`opening ${io.baseUrl}`);
        return 0;
      }

      default:
        io.stderr(`brian: unknown command "${cmd}"\n\n${USAGE.trimEnd()}`);
        return 1;
    }
  } catch (err) {
    if (err instanceof ServerUnreachableError) {
      io.stderr(
        `brian: server not running at ${err.url} (start it with: bun run start in <repo>, or check launchd)`,
      );
      return 2;
    }
    if (err instanceof ApiRequestError) {
      io.stderr(`brian: ${err.message}`);
      return 1;
    }
    if (err instanceof UsageError) {
      io.stderr(`brian: ${err.message}`);
      return 1;
    }
    io.stderr(`brian: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}
