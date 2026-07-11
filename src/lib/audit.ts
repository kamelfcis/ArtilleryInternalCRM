import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AuditAction, EntityType } from "@/lib/constants";

interface AuditInput {
  userId: string | null;
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append an entry to the audit trail. Best-effort: auditing must never break
 * the primary operation, so failures are logged and swallowed. Client IP and
 * user agent are captured from request headers when available.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    let ipAddress: string | undefined;
    let userAgent: string | undefined;
    try {
      const h = headers();
      ipAddress =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        undefined;
      userAgent = h.get("user-agent") ?? undefined;
    } catch {
      // headers() is unavailable outside a request scope (e.g. seed script).
    }

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record audit entry", error);
  }
}
