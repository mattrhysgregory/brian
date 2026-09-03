import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { STATUS_LABELS, STATUSES, type Issue, type Status } from "@brain/shared";
import { boardCoordinateGetter } from "@/lib/boardKeyboard";
import { Column } from "./Column";
import { IssueCard } from "./IssueCard";

function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function Board({
  issues,
  commentCounts,
  totalCounts,
  onOpenIssue,
  onMove,
  onClear,
  clearingStatus,
}: {
  issues: Issue[];
  commentCounts: Record<number, number>;
  /** Per-column totals across all projects, ignoring the project filter. */
  totalCounts: Record<Status, number>;
  onOpenIssue: (id: number) => void;
  onMove: (id: number, status: Status) => void;
  onClear: (status: Status) => void;
  clearingStatus: Status | null;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    // A small distance threshold keeps a plain click on a card as "open".
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: boardCoordinateGetter }),
  );

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map((s) => [s, [] as Issue[]])) as Record<
      Status,
      Issue[]
    >;
    for (const issue of issues) map[issue.status].push(issue);
    return map;
  }, [issues]);

  const activeIssue = activeId == null ? null : (issues.find((i) => i.id === activeId) ?? null);

  const describe = (id: number | string) =>
    issues.find((i) => i.id === Number(id))?.title ?? `issue ${id}`;

  const column = (over: { id: number | string; data: { current?: { status?: unknown } } }) => {
    const status = over.data.current?.status ?? over.id;
    return isStatus(status) ? STATUS_LABELS[status] : String(over.id);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(Number(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    // `over` is either a column droppable or another card; both carry a status.
    const target = over.data.current?.status ?? over.id;
    if (!isStatus(target)) return;

    const from = active.data.current?.status;
    if (from === target) return;
    onMove(Number(active.id), target);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${describe(active.id)}.`,
          onDragOver: ({ over }) => (over ? `Over ${column(over)}.` : "Not over a column."),
          onDragEnd: ({ active, over }) =>
            over
              ? `Moved ${describe(active.id)} to ${column(over)}.`
              : "Dropped outside a column.",
          onDragCancel: ({ active }) => `Move of ${describe(active.id)} cancelled.`,
        },
        screenReaderInstructions: {
          draggable:
            "Press space or enter to pick up an issue. Use the arrow keys to move it between columns, then press space or enter to drop it. Press escape to cancel.",
        },
      }}
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-4 lg:overflow-hidden">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            issues={byStatus[status]}
            commentCounts={commentCounts}
            totalCount={totalCounts[status]}
            onOpenIssue={onOpenIssue}
            onClear={() => onClear(status)}
            clearing={clearingStatus === status}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeIssue && (
          <IssueCard
            issue={activeIssue}
            commentCount={commentCounts[activeIssue.id]}
            overlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
