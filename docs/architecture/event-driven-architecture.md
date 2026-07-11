# Event-Driven Architecture

> Artillery CRM/DMS — قسم الاحتياجات
> Status: **Phase 3.1 complete.** Every business write emits exactly one domain
> event. All side effects (currently: the audit trail) live in subscribers.

---

## 1. Why

Cross-cutting concerns — audit logging today; notifications, email/SMS, AI
indexing and workflow triggers in later phases — used to be called imperatively
from inside every service. That couples each write path to every concern and
makes new reactions expensive and risky to add.

With an event-driven core, **business services emit facts** ("a company was
created", "a document was uploaded") and **subscribers react**. Services no
longer know — or care — who listens. New behaviour is added by writing a new
subscriber, never by editing a service.

**Rule:** a business service must **only** emit domain events. It must never
directly call audit logging, notification creation, workflow actions, or
analytics.

---

## 2. Event lifecycle

```
1. A service performs a write inside a DB transaction.
2. The transaction COMMITS.                     ← events describe facts
3. The service calls emitEvent({ ... }) AFTER the commit.
4. emitEvent stamps eventId (uuid) + occurredAt and hands the event to the bus.
5. The bus dispatches the event to every subscriber registered for its name,
   plus any wildcard (onAny) subscribers — in registration order.
6. Each subscriber runs in its own try/catch (error isolation).
7. emitEvent resolves after all subscribers finish (awaited in-request).
```

Emit is **after commit**: a failed transaction never emits. Emit is **awaited
in the request** so request-scoped subscribers (the audit logger reads
`next/headers` for IP/User-Agent) work correctly.

---

## 3. Event flow

```
        ┌──────────────────────────────────────────────┐
        │  Service (auth, users, folders, documents,   │
        │  trash, CRM, download route)                 │
        │      … write commits …                       │
        │      emitEvent({ eventName, entityType, … }) │
        └───────────────────────┬──────────────────────┘
                                │  (after commit)
                                ▼
                    ┌───────────────────────┐
                    │       Event Bus       │   src/lib/events/bus.ts
                    │  stamp eventId + time  │   (singleton, in-process,
                    │  fan-out, error-iso.   │    error-isolated)
                    └───────────┬───────────┘
             ┌──────────────────┼─────────────────────┐
             ▼                  ▼                      ▼
     ┌──────────────┐   ┌──────────────┐     ┌────────────────────┐
     │    Audit     │   │     Log      │     │  (future: Notif.,  │
     │  Subscriber  │   │  Subscriber  │     │  Workflow, Email,  │
     │ → AuditLog   │   │ → console    │     │  Analytics, AI)    │
     └──────────────┘   └──────────────┘     └────────────────────┘
```

Subscribers are **independent**: they are registered by event name and never
reference one another. Removing or adding one changes nothing for the others.

---

## 4. The event envelope

Every event — regardless of module — has exactly this shape
(`src/lib/events/types.ts`):

| Field           | Type                     | Notes                                             |
| --------------- | ------------------------ | ------------------------------------------------- |
| `eventId`       | `string` (uuid v4)       | Unique per occurrence; stamped on emit            |
| `eventName`     | `EventName`              | From the catalog — strongly typed, no magic string |
| `occurredAt`    | `Date`                   | Stamped on emit                                   |
| `actorId`       | `string \| null`         | `null` for anonymous/system                       |
| `entityType`    | `EntityType`             | Reuses `ENTITY_TYPES` (FOLDER/DOCUMENT/USER/CRM…) |
| `entityId`      | `string`                 | Empty only for anonymous events (unknown-account login) |
| `metadata`      | `Record<string,unknown>?`| Structured data: `name`, `previousName`, `size`, … |
| `correlationId` | `string?`                | Reserved for Phase 3.2 workflows                  |

Producers supply everything except `eventId`/`occurredAt` (stamped by
`emitEvent`).

---

## 5. Event catalog

The **single source of truth** is `src/lib/events/catalog.ts` — a strongly-typed
constant object. There are no magic strings anywhere; producers and subscribers
reference `EVENT_NAMES.*`.

| Module        | Events                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Authentication| `user.logged_in`, `user.logged_out`, `user.login_failed`, `user.password_changed`                      |
| Users         | `user.created`, `user.updated`, `user.role_changed`, `user.deleted`                                    |
| Folders       | `folder.created`, `folder.renamed`, `folder.moved`*, `folder.deleted`, `folder.restored`               |
| Documents     | `document.uploaded`, `document.updated`, `document.deleted`, `document.restored`, `document.version.created`, `document.downloaded` |
| CRM records   | `crm.record.created`, `crm.record.updated`, `crm.record.deleted` (entityType = COMPANY/CONTRACT/…)     |
| Recycle bin   | `recycle.purged`, `recycle.restored`*                                                                   |

`*` declared for completeness but not yet emitted: `folder.moved` (no move
feature yet) and `recycle.restored` (restore currently emits the more specific
`folder.restored` / `document.restored`).

---

## 6. Subscribers

Registered once at bus construction (`src/lib/events/index.ts`).

- **Audit subscriber** (`subscribers/audit-subscriber.ts`) — the single place
  that turns events into `AuditLog` rows. It owns all audit phrasing (Arabic
  summaries) and the `eventName → AuditAction` mapping. Behaviour-preserving:
  identical action, entityType, summary and metadata to the pre-migration code.
- **Log subscriber** (`subscribers/log-subscriber.ts`) — dev-only; logs every
  event via `onAny`. Demonstrates independent fan-out.

Planned (not implemented — Phase 3.2+): Notification, Workflow, Analytics,
Email, AI Indexing. Each is added as a new file + one `register…(bus)` call.

---

## 7. Error isolation & transaction boundary

- **Error isolation.** `EventBus.emit` wraps every handler in its own
  `try/catch`. A throwing subscriber is logged (`[events] subscriber failed…`)
  and skipped. It never aborts the emit, the other subscribers, the API request,
  or the (already-committed) transaction.
- **Transaction boundary.** `emitEvent` is called **only after** the write has
  committed. Failed transactions never emit. Never emit from inside a
  `prisma.$transaction` callback.

---

## 8. Best practices

- Emit **after commit**, never before.
- Emit **exactly one** event per business write. If an operation can be several
  things (e.g. user update vs. role change vs. deactivate), pick the single most
  specific `eventName`.
- Put the human-readable record name in `metadata.name`; put "before" values in
  `metadata.previousX`. Presentation-only keys (`name`, `email`, `reason`,
  `version`) are used to build summaries and are **not** stored on the audit row.
- Services must not import `@/lib/audit` (or, later, notifications). Only
  subscribers do. Enforce by review; a lint rule can be added later.
- Keep subscribers independent — never let one call or depend on another.

---

## 9. How to add a new event

1. Add the name to `EVENT_NAMES` in `src/lib/events/catalog.ts`.
2. Emit it from the service **after commit**:
   ```ts
   import { emitEvent, EVENT_NAMES } from "@/lib/events";

   await emitEvent({
     eventName: EVENT_NAMES.MyNewThingHappened,
     actorId: user.id,
     entityType: ENTITY_TYPES.DOCUMENT,
     entityId: doc.id,
     metadata: { name: doc.name },
   });
   ```
3. Handle it in the subscriber(s) that care (e.g. add a case to the audit
   subscriber's `ACTION_BY_EVENT` + `summaryFor`). Unhandled events are simply
   ignored by the audit subscriber (future-safe).
4. Typecheck + build. No producer or other subscriber needs to change.

---

## 10. Files

```
src/lib/events/
  catalog.ts                     # EVENT_NAMES (single source of truth)
  types.ts                       # DomainEvent envelope
  bus.ts                         # EventBus (fan-out, error isolation)
  index.ts                       # singleton + emitEvent()
  subscribers/
    audit-subscriber.ts          # events → AuditLog
    log-subscriber.ts            # events → console (dev)
```
