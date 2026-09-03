import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { type: "issue", status: issue.status },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // The card itself is the drag handle; Enter/Space picks it up via the
      // KeyboardSensor, so clicks are only opened on a genuine pointer click.
      className="list-none touch-none"
    >
      <IssueCard issue={issue} commentCount={commentCount} onOpen={onOpen} dragging={isDragging} />
    </li>
  );
}
