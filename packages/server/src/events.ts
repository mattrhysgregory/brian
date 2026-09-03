import type { ChangedEvent } from "@brain/shared";

export type ChangedListener = (event: ChangedEvent) => void;

/** Tiny in-process pub/sub for change notifications feeding the SSE stream. */
export class EventBus {
  #listeners = new Set<ChangedListener>();

  subscribe(listener: ChangedListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: ChangedEvent): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener(event);
      } catch {
        // a broken subscriber must not break the mutation that emitted
      }
    }
  }

  get size(): number {
    return this.#listeners.size;
  }
}
