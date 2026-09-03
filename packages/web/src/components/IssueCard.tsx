import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import type { Issue } from "@brian/shared";
import { Badge } from "@/components/ui/badge";
import { projectStyle } from "@/lib/projectColor";
import { GitHubMark } from "./GitHubMark";
import { extractGitHubRefs, type GitHubRef } from "@/lib/github";
import { absoluteTime, relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface IssueCardProps {
  issue: Issue;
  commentCount?: number;
  onOpen?: () => void;
  dragging?: boolean;
  overlay?: boolean;
  /** Rendered top-right; carries dnd-kit's listeners in SortableIssueCard. */
  dragHandle?: React.ReactNode;
}

function chipLabel(ref: GitHubRef): string {
  return ref.number != null ? `${ref.repo}#${ref.number}` : `${ref.owner}/${ref.repo}`;
}

function Chip({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      // The card body is a button and the grip starts drags; neither should
      // react to a chip click.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="inline-flex max-w-full items-center gap-1 rounded border border-border px-1 py-px text-[10px] leading-4 text-muted transition-colors hover:border-muted hover:text-fg focus-visible:text-fg"
    >
      <GitHubMark className="shrink-0" />
      <span className="truncate">{children}</span>
    </a>
  );
}

/**
 * Every pull/issue link gets its own chip — issues often reference several PRs
 * — while plain repo/commit/blob links collapse into one trailing chip.
 */
function GitHubChips({ refs }: { refs: GitHubRef[] }) {
  const numbered = refs.filter((r) => r.number != null);
  const others = refs.filter((r) => r.number == null);
  if (numbered.length === 0 && others.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {numbered.map((ref) => (
        <Chip key={ref.url} href={ref.url} title={ref.url}>
          {chipLabel(ref)}
        </Chip>
      ))}
      {others.length === 1 && (
        <Chip href={others[0]!.url} title={others[0]!.url}>
          {chipLabel(others[0]!)}
        </Chip>
      )}
      {others.length > 1 && (
        <Chip href={others[0]!.url} title={others.map((r) => r.url).join("\n")}>
          +{others.length}
        </Chip>
      )}
    </div>
  );
}

/**
 * Presentational card. Drag wiring lives in SortableIssueCard so the same
 * markup can be reused inside the DragOverlay.
 */
export function IssueCard({
  issue,
  commentCount,
  onOpen,
  dragging,
  overlay,
  dragHandle,
}: IssueCardProps) {
  const refs = useMemo(() => extractGitHubRefs(issue.description), [issue.description]);

  const body = (
    <>
      <p className="pr-6 text-[13px] leading-snug">{issue.title}</p>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
        {issue.project && (
          <Badge className="project-badge" style={projectStyle(issue.project)}>
            {issue.project}
          </Badge>
        )}
        <span title={absoluteTime(issue.updated_at)}>{relativeTime(issue.updated_at)}</span>
        {commentCount != null && commentCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1" title={`${commentCount} comments`}>
            <MessageSquare className="size-3" aria-hidden />
            {commentCount}
          </span>
        )}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "group relative rounded-md border border-border bg-card transition-colors",
        issue.project && "project-stripe",
        onOpen && "hover:border-muted focus-within:border-muted",
        dragging && "opacity-40",
        overlay && "shadow-lg",
      )}
      style={issue.project ? projectStyle(issue.project) : undefined}
    >
      {onOpen ? (
        // A real button, so the card is reachable and openable from the
        // keyboard without stealing Enter/Space from the drag handle.
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open issue: ${issue.title}`}
          className="block w-full cursor-pointer rounded-md p-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </button>
      ) : (
        <div className="p-2.5">{body}</div>
      )}
      {/* Outside the card button: an anchor may not nest inside it. */}
      {refs.length > 0 && (
        <div className="-mt-1 px-2.5 pb-2.5">
          <GitHubChips refs={refs} />
        </div>
      )}
      {dragHandle}
    </div>
  );
}
