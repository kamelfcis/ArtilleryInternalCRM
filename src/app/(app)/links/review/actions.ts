"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { decideLink, type LinkDecision } from "@/lib/linking/review-service";
import { AppError } from "@/lib/errors";
import { errorState, type ActionState } from "@/lib/action-result";

/**
 * Single server action behind the link review queue. Authenticates, reads the
 * decision from the form, and delegates every rule (RBAC + state machine +
 * event emission) to the review service. Revalidates the queue and dashboard.
 */
export async function decideLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const linkId = String(formData.get("linkId") ?? "");
  const decision = String(formData.get("decision") ?? "") as LinkDecision;

  if (!linkId || (decision !== "CONFIRM" && decision !== "REJECT")) {
    return errorState("طلب غير صالح");
  }

  try {
    await decideLink({
      linkId,
      decision,
      actor: { id: user.id, role: user.role },
    });

    revalidatePath("/links/review");
    revalidatePath("/");

    return {
      ok: true,
      message: decision === "CONFIRM" ? "تم تأكيد الرابط" : "تم رفض الرابط",
    };
  } catch (error) {
    if (error instanceof AppError) return errorState(error.message);
    console.error("[links.review.action] unexpected error", error);
    return errorState("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى");
  }
}
