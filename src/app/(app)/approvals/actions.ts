"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { performTransition } from "@/lib/approvals/service";
import { subjectMeta } from "@/lib/approvals/subjects";
import type { ApprovalAction } from "@/lib/approvals/constants";
import { AppError } from "@/lib/errors";
import { errorState, type ActionState } from "@/lib/action-result";

/**
 * Single server action behind the reusable approval panel. Delegates all rules
 * to the approval service (state machine + RBAC + event emission); this layer
 * only authenticates, reads the form, and revalidates affected paths.
 */
export async function runApprovalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const subjectType = String(formData.get("subjectType") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const action = String(formData.get("action") ?? "") as ApprovalAction;
  const comment = String(formData.get("comment") ?? "");

  if (!subjectType || !subjectId || !action) {
    return errorState("طلب غير صالح");
  }

  try {
    await performTransition({
      subjectType,
      subjectId,
      action,
      comment,
      actor: { id: user.id, role: user.role },
    });

    const meta = subjectMeta(subjectType);
    if (meta) revalidatePath(meta.href(subjectId));
    revalidatePath("/approvals");
    revalidatePath("/");

    return { ok: true, message: "تم تنفيذ الإجراء بنجاح" };
  } catch (error) {
    if (error instanceof AppError) return errorState(error.message);
    console.error("[approvals.action] unexpected error", error);
    return errorState("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى");
  }
}
