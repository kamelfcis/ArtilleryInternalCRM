import type { EventName } from "./catalog";
import type { EntityType } from "@/lib/constants";

/**
 * Normalized domain-event envelope. Every event — regardless of module — has
 * exactly this shape.
 *
 * Producers describe *facts* (what happened) via a strongly-typed `eventName`
 * (see ./catalog) plus structured `metadata`; they never perform side effects.
 * `entityType` reuses the system entity enum (`ENTITY_TYPES`), so there are no
 * magic strings. Side effects (audit, and later notifications/workflow) live in
 * subscribers.
 */
export interface DomainEvent {
  /** Unique id for this specific occurrence (uuid v4). */
  eventId: string;
  /** Strongly-typed event name from the central catalog. */
  eventName: EventName;
  /** When the event occurred (stamped by `emitEvent`). */
  occurredAt: Date;
  /** The user responsible; null for anonymous/system actions. */
  actorId: string | null;
  /** The kind of entity the event concerns (FOLDER, DOCUMENT, USER, COMPANY…). */
  entityType: EntityType;
  /**
   * The affected entity's id. May be empty only for anonymous events with no
   * subject (e.g. a failed login for an unknown account).
   */
  entityId: string;
  /** Structured, event-specific data (display name, previous values, size…). */
  metadata?: Record<string, unknown>;
  /**
   * Correlates a chain of related events across a single workflow/request.
   * Reserved for Phase 3.2+ (workflow & approvals); unused today.
   */
  correlationId?: string;
}
