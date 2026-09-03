import { useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal } from "lucide-react";
import type { Issue, Status } from "@brain/shared";
import { STATUS_LABELS } from "@brain/shared";
import { SortableIssueCard } from "./SortableIssueCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function Column({
  status,
  issues,
  commentCounts,
  totalCount,
  onOpenIssue,
  onClear,
  clearing = false,
}: {
  status: Status;
  issues: Issue[];
  commentCounts: Record<number, number>;
  /** Issues in this column across all projects — what "clear" would delete. */
  totalCount: number;
  onOpenIssue: (id: number) => void;
  onClear: () => void;
  clearing?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });
  const [confirming, setConfirming] = useState(false);

  // Someone else (or an agent) may empty the column while the confirm is open.
  useEffect(() => {
    if (totalCount === 0) setConfirming(false);
  }, [totalCount]);

  const label = STATUS_LABELS[status];

  return (
    <section className="flex min-h-0 flex-col" aria-label={label}>
      <div className="flex min-h-7 items-center gap-2 px-1 pb-2">
        {confirming ? (
          <>
            <span className="text-[12px] text-muted">
              Delete {totalCount} {totalCount === 1 ? "issue" : "issues"} in {label}?
            </span>
            <Button
              size="sm"
              variant="danger"
              disabled={clearing}
              onClick={() => {
                setConfirming(false);
                onClear();
              }}
            >
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-[12px] font-medium">{label}</h2>
            <span className="text-[11px] tabular-nums text-muted">{issues.length}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${label} column actions`}
                  className="ml-auto rounded p-0.5 text-muted hover:bg-accent hover:text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-border"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={totalCount === 0}
                  onSelect={() => setConfirming(true)}
                  className="text-danger"
                >
                  Delete all {totalCount} {totalCount === 1 ? "issue" : "issues"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto rounded-lg border border-transparent bg-panel p-1.5 transition-colors",
          isOver && "border-border",
        )}
      >
        <SortableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-1.5">
            {issues.map((issue) => (
              <SortableIssueCard
                key={issue.id}
                issue={issue}
                commentCount={commentCounts[issue.id]}
                onOpen={() => onOpenIssue(issue.id)}
              />
            ))}
          </ul>
        </SortableContext>

        {issues.length === 0 && (
          <p className="px-1.5 py-6 text-center text-[12px] text-muted">Nothing here</p>
        )}
      </div>
    </section>
  );
}
