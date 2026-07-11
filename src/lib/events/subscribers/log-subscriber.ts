import "server-only";
import type { EventBus } from "../bus";

/**
 * Development-only observability subscriber. Logs every domain event to the
 * server console, demonstrating that independent concerns (audit + logging)
 * react to the same emit without the producer — or each other — knowing.
 * Disabled in production to avoid noise.
 */
export function registerLogSubscriber(bus: EventBus): void {
  if (process.env.NODE_ENV === "production") return;
  bus.onAny((event) => {
    console.info(
      `[events] ${event.eventName} ` +
        `(id=${event.eventId.slice(0, 8)}, actor=${event.actorId ?? "system"}, ` +
        `${event.entityType}:${event.entityId || "-"})`,
    );
  });
}
