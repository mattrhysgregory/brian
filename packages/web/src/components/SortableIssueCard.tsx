import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Issue } from "@brain/shared";
import { IssueCard } from "./IssueCard";

export function SortableIssueCard({
  issue,
  commentCount,
  onOpen,
}: {
  issue: Issue;
  commentCount?: number;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: issue.id,
      data: { type: "issue", status: issue.status },
    });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="list-none"
    >
      <IssueCard
        issue={issue}
        commentCount={commentCount}
        onOpen={onOpen}
        dragging={isDragging}
        dragHandle={
          // Only the grip drags, so the card body stays a plain button. The
          // KeyboardSensor picks the card up from here with Enter/Space.
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label="Drag"
            className="absolute right-1 top-1 cursor-grab touch-none rounded p-1 text-muted opacity-0 transition-opacity hover:text-fg focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 aria-[pressed=true]:opacity-100"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        }
      />
    </li>
  );
}
