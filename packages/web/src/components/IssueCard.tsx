import { MessageSquare } from "lucide-react";
import type { Issue } from "@brian/shared";
import { Badge } from "@/components/ui/badge";
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
  const body = (
    <>
      <p className="pr-6 text-[13px] leading-snug">{issue.title}</p>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
        {issue.project && <Badge>{issue.project}</Badge>}
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
        onOpen && "hover:border-muted focus-within:border-muted",
        dragging && "opacity-40",
        overlay && "shadow-lg",
      )}
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
      {dragHandle}
    </div>
  );
}
