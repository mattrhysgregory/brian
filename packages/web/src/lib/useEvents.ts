import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChangedEvent } from "@brian/shared";

/**
 * Subscribes to the server's SSE stream and invalidates the TanStack caches on
 * every `changed` event. EventSource reconnects on its own, so there is no
 * retry logic here beyond letting the browser do it.
 */
export function useEvents() {
  const qc = useQueryClient();

  useEffect(() => {
    const source = new EventSource("/api/events");

    const onChanged = (event: MessageEvent<string>) => {
      let payload: ChangedEvent | null = null;
      try {
        payload = JSON.parse(event.data) as ChangedEvent;
      } catch {
        /* Malformed frame: fall through to a blanket invalidation. */
      }

      void qc.invalidateQueries({ queryKey: ["issues"] });
      if (payload?.kind === "issue") {
        void qc.invalidateQueries({ queryKey: ["issue", payload.id] });
      } else {
        // Comment changes carry the comment id, not the issue id.
        void qc.invalidateQueries({ queryKey: ["issue"] });
      }
    };

    source.addEventListener("changed", onChanged as EventListener);
    return () => {
      source.removeEventListener("changed", onChanged as EventListener);
      source.close();
    };
  }, [qc]);
}
