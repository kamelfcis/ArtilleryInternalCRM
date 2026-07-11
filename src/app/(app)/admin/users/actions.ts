"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/current-user";
import { ROLES, type Role } from "@/lib/constants";
import { createUser, updateUser } from "@/lib/services/users";
import { createUserSchema, updateUserSchema } from "@/lib/validators";
import { AppError } from "@/lib/errors";
import {
  errorState,
  fieldErrorState,
  type ActionState,
} from "@/lib/action-result";

function toErrorState(error: unknown): ActionState {
  if (error instanceof AppError) return errorState(error.message);
  console.error("[users.action] unexpected error", error);
  return errorState("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى");
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole(ROLES.ADMIN);
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    jobTitle: formData.get("jobTitle") ?? "",
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  try {
    await createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      jobTitle: parsed.data.jobTitle || null,
      role: parsed.data.role as Role,
      password: parsed.data.password,
      actorId: admin.id,
    });
    revalidatePath("/admin/users");
    return { ok: true, message: "تم إنشاء المستخدم بنجاح" };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole(ROLES.ADMIN);
  const parsed = updateUserSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    jobTitle: formData.get("jobTitle") ?? "",
    role: formData.get("role"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  // Safety: an admin cannot demote or deactivate their own account, which
  // could otherwise lock the last administrator out of the system.
  if (parsed.data.id === admin.id) {
    if (parsed.data.role !== ROLES.ADMIN) {
      return errorState("لا يمكنك تغيير دورك الخاص");
    }
    if (!parsed.data.isActive) {
      return errorState("لا يمكنك تعطيل حسابك الخاص");
    }
  }

  try {
    await updateUser({
      id: parsed.data.id,
      name: parsed.data.name,
      jobTitle: parsed.data.jobTitle || null,
      role: parsed.data.role as Role,
      isActive: parsed.data.isActive,
      actorId: admin.id,
    });
    revalidatePath("/admin/users");
    return { ok: true, message: "تم حفظ التعديلات" };
  } catch (error) {
    return toErrorState(error);
  }
}
