import type { KeyboardCoordinateGetter } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { STATUSES, type Status } from "@brain/shared";

/**
 * dnd-kit's default sortable coordinate getter only walks items inside the
 * same SortableContext, so left/right arrows cannot leave a column. This
 * getter handles the horizontal axis by jumping to the neighbouring column's
 * droppable rect and delegates the vertical axis to the stock behaviour.
 */
export const boardCoordinateGetter: KeyboardCoordinateGetter = (event, args) => {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") {
    return sortableKeyboardCoordinates(event, args);
  }

  const { active, collisionRect, droppableContainers } = args.context;
  if (!collisionRect) return undefined;

  const columns = STATUSES.map((status) => droppableContainers.get(status)).filter(
    (container): container is NonNullable<typeof container> => Boolean(container?.rect.current),
  );
  if (columns.length === 0) return undefined;

  const cx = collisionRect.left + collisionRect.width / 2;
  const cy = collisionRect.top + collisionRect.height / 2;

  let index = columns.findIndex((container) => {
    const rect = container.rect.current!;
    return cx >= rect.left && cx <= rect.left + rect.width && cy >= rect.top && cy <= rect.top + rect.height;
  });
  if (index === -1) {
    const from = active?.data.current?.status as Status | undefined;
    index = columns.findIndex((container) => container.id === from);
  }
  if (index === -1) return undefined;

  const next = columns[index + (event.code === "ArrowRight" ? 1 : -1)];
  if (!next) return undefined;

  const rect = next.rect.current!;
  // Land just inside the column so collision detection resolves to it (or to
  // its first card), rather than to the gap between columns.
  return { x: rect.left + 8, y: rect.top + 8 };
};
