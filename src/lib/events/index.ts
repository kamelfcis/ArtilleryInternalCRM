import "server-only";
import { randomUUID } from "crypto";
import type { EntityType } from "@/lib/constants";
import { EventBus } from "./bus";
import type { EventName } from "./catalog";
import type { DomainEvent } from "./types";
import { registerAuditSubscriber } from "./subscribers/audit-subscriber";
import { registerLogSubscriber } from "./subscribers/log-subscriber";
import { registerNotificationSubscriber } from "./subscribers/notification-subscriber";

/**
 * Singleton domain-event bus.
 *
 * Cached on `globalThis` so Next.js dev HMR does not create duplicate buses or
 * double-register subscribers (which would double-write audit entries). Mirrors
 * the Prisma client singleton pattern used across the codebase.
 */
const globalForEvents = globalThis as unknown as {
  eventBus: EventBus | undefined;
};

function createBus(): EventBus {
  const bus = new EventBus();
  // Subscribers are registered once, here, and are independent of each other.
  registerAuditSubscriber(bus);
  registerNotificationSubscriber(bus);
  registerLogSubscriber(bus);
  return bus;
}

export const eventBus = globalForEvents.eventBus ?? createBus();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.eventBus = eventBus;
}

/** Producer-facing payload: the envelope minus the fields stamped on emit. */
export interface EmitInput {
  eventName: EventName;
  actorId: string | null;
  entityType: EntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Emit a domain event.
 *
 * IMPORTANT: call this ONLY after the underlying write/transaction has
 * committed — events represent facts that already happened, so a failed
 * transaction must never emit. `eventId` and `occurredAt` are stamped here.
 *
 * Awaited so request-scoped subscribers (audit) run inside the same request;
 * best-effort — subscriber failures are isolated by the bus and never surface
 * to the caller.
 */
export async function emitEvent(input: EmitInput): Promise<void> {
  const event: DomainEvent = {
    eventId: randomUUID(),
    occurredAt: new Date(),
    ...input,
  };
  await eventBus.emit(event);
}

export { EVENT_NAMES } from "./catalog";
export type { EventName } from "./catalog";
export type { DomainEvent } from "./types";
