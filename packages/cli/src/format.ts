import type { Comment, Issue, IssueWithComments } from "@brain/shared";

export function table(rows: string[][], headers: string[]): string {
  const all = [headers, ...rows];
  const widths = headers.map((_, col) => Math.max(...all.map((row) => (row[col] ?? "").length)));
  return all
    .map((row) => row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("  ").trimEnd())
    .join("\n");
}

export function shortDate(iso: string): string {
  // e.g. 2026-09-03T10:00:00.000Z -> 09-03 10:00
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatIssueList(issues: Issue[]): string {
  if (issues.length === 0) return "no issues";
  const rows = issues.map((i) => [
    `#${i.id}`,
    i.status,
    i.project ?? "-",
    i.title,
    shortDate(i.updated_at),
  ]);
  return table(rows, ["ID", "STATUS", "PROJECT", "TITLE", "UPDATED"]);
}

export function excerpt(body: string, maxLen = 80): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen - 1)}…` : oneLine;
}

export function formatAttention(issues: Issue[], latestComments: Map<number, Comment | null>): string {
  if (issues.length === 0) return "nothing needs attention";
  const rows = issues.map((i) => {
    const comment = latestComments.get(i.id);
    const commentText = comment ? `${comment.author}: ${excerpt(comment.body)}` : "-";
    return [`#${i.id}`, i.status, i.project ?? "-", i.title, commentText];
  });
  return table(rows, ["ID", "STATUS", "PROJECT", "TITLE", "LATEST COMMENT"]);
}

export function formatIssueDetail(issue: IssueWithComments): string {
  const lines: string[] = [];
  lines.push(`#${issue.id} ${issue.title}`);
  lines.push(
    `status: ${issue.status}  project: ${issue.project ?? "-"}  author: ${issue.created_by}`,
  );
  lines.push(`created: ${shortDate(issue.created_at)}  updated: ${shortDate(issue.updated_at)}`);
  lines.push("");
  lines.push(issue.description?.trim() ? issue.description : "(no description)");
  lines.push("");
  lines.push(`-- comments (${issue.comments.length}) --`);
  if (issue.comments.length === 0) {
    lines.push("(none)");
  } else {
    for (const c of issue.comments) {
      lines.push("");
      lines.push(`[#${c.id}] ${c.author} @ ${shortDate(c.created_at)}`);
      lines.push(c.body);
    }
  }
  return lines.join("\n");
}
