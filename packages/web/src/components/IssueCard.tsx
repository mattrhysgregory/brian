import { MessageSquare } from "lucide-react";
import type { Issue } from "@brain/shared";
import { Badge } from "@/components/ui/badge";
import { absoluteTime, relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface IssueCardProps {
  issue: Issue;
  commentCount?: number;
  onOpen?: () => void;
  dragging?: boolean;
  overlay?: boolean;
}

/**
 * Presentational card. Drag wiring lives in SortableIssueCard so the same
 * markup can be reused inside the DragOverlay.
 */
export function IssueCard({ issue, commentCount, onOpen, dragging, overlay }: IssueCardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card p-2.5 transition-colors",
        onOpen && "cursor-pointer hover:border-muted",
        dragging && "opacity-40",
        overlay && "shadow-lg",
      )}
      onClick={onOpen}
    >
      <p className="text-[13px] leading-snug">{issue.title}</p>
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
    </div>
  );
}
