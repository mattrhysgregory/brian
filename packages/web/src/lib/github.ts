/**
 * Finds GitHub links inside a markdown description so the board can surface
 * them as chips. Deliberately regex-based: descriptions are short and we only
 * need the URLs, not a parse tree.
 */

export type GitHubRefKind = "pull" | "issue" | "other";

export interface GitHubRef {
  url: string;
  owner: string;
  repo: string;
  kind: GitHubRefKind;
  number?: number;
}

// Matches bare URLs and the target of markdown links alike — in `[text](url)`
// the url appears literally in the source, so one sweep covers both.
const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/g;

/** Trailing punctuation is far more often prose than part of the URL. */
function trimTrailing(url: string): string {
  return url.replace(/[.,;:!?]+$/, "");
}

function isGitHubHost(host: string): boolean {
  return host === "github.com" || host.endsWith(".github.com");
}

function classify(segments: string[]): { kind: GitHubRefKind; number?: number } {
  const [, , type, rawNumber] = segments;
  const number = Number(rawNumber);
  if (!Number.isInteger(number) || number <= 0) return { kind: "other" };
  if (type === "pull" || type === "pulls") return { kind: "pull", number };
  if (type === "issues" || type === "issue") return { kind: "issue", number };
  return { kind: "other" };
}

export function extractGitHubRefs(markdown: string | null): GitHubRef[] {
  if (!markdown) return [];

  const refs: GitHubRef[] = [];
  const seen = new Set<string>();

  for (const match of markdown.matchAll(URL_RE)) {
    const raw = trimTrailing(match[0]);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (!isGitHubHost(url.hostname.toLowerCase())) continue;

    const segments = url.pathname.split("/").filter(Boolean);
    const [owner, repo] = segments;
    if (!owner || !repo) continue;

    const { kind, number } = classify(segments);
    // Two spellings of the same pull request are one chip; anything else is
    // keyed by its URL so distinct links survive.
    const key = number != null ? `${owner}/${repo}#${kind}${number}` : raw;
    if (seen.has(key)) continue;
    seen.add(key);

    refs.push({ url: raw, owner, repo, kind, ...(number != null ? { number } : {}) });
  }

  return refs;
}
