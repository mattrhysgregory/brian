import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Issue, Status } from "@brain/shared";
import { STATUS_LABELS } from "@brain/shared";
import { SortableIssueCard } from "./SortableIssueCard";
import { cn } from "@/lib/utils";

export function Column({
  status,
  issues,
  commentCounts,
  onOpenIssue,
}: {
  status: Status;
  issues: Issue[];
  commentCounts: Record<number, number>;
  onOpenIssue: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });

  return (
    <section className="flex min-h-0 flex-col" aria-label={STATUS_LABELS[status]}>
      <div className="flex items-baseline gap-2 px-1 pb-2">
        <h2 className="text-[12px] font-medium">{STATUS_LABELS[status]}</h2>
        <span className="text-[11px] tabular-nums text-muted">{issues.length}</span>
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
