import "server-only";
import type { EventName } from "./catalog";
import type { DomainEvent } from "./types";

export type EventHandler = (event: DomainEvent) => void | Promise<void>;

/**
 * Minimal in-process, synchronous domain-event bus.
 *
 * Subscribers are fully independent — they are registered by name and never
 * reference one another. Handlers run in registration order and are awaited
 * *within the emitting request*, so request-scoped APIs used by a subscriber
 * (e.g. `next/headers` in the audit logger) remain available.
 *
 * Error isolation: every handler runs in its own try/catch. A failing
 * subscriber is logged and skipped — it never aborts the emit, the other
 * subscribers, the API request, or the (already-committed) transaction.
 *
 * Deliberately in-process. `emit` is the single seam where a durable
 * queue/outbox could later be introduced (retries, email/SMS, AI indexing)
 * without changing a single producer.
 */
export class EventBus {
  private readonly handlers = new Map<EventName, Set<EventHandler>>();
  private readonly wildcard = new Set<EventHandler>();

  /** Subscribe to one event name. Returns an unsubscribe function. */
  on(eventName: EventName, handler: EventHandler): () => void {
    const set = this.handlers.get(eventName) ?? new Set<EventHandler>();
    set.add(handler);
    this.handlers.set(eventName, set);
    return () => set.delete(handler);
  }

  /** Subscribe to every event (observability/logging). */
  onAny(handler: EventHandler): () => void {
    this.wildcard.add(handler);
    return () => this.wildcard.delete(handler);
  }

  /** Dispatch an event to all matching subscribers, error-isolated. */
  async emit(event: DomainEvent): Promise<void> {
    const subscribers = [
      ...(this.handlers.get(event.eventName) ?? []),
      ...this.wildcard,
    ];
    for (const handler of subscribers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(
          `[events] subscriber failed for "${event.eventName}" (eventId=${event.eventId})`,
          error,
        );
      }
    }
  }
}
