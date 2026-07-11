"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import { ENTITY_TYPES, type Role } from "@/lib/constants";
import { loginSchema } from "@/lib/validators";
import {
  errorState,
  fieldErrorState,
  type ActionState,
} from "@/lib/action-result";

/**
 * Credentials login. On success, issues a signed session cookie and redirects
 * to the originally requested page. Failures are audited without leaking
 * whether the email exists (uniform "invalid credentials" response).
 */
export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  const { email, password } = parsed.data;
  const nextPath = sanitizeNext(formData.get("next"));

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  const invalid = errorState("البريد الإلكتروني أو كلمة المرور غير صحيحة");

  if (!user) {
    await emitEvent({
      eventName: EVENT_NAMES.UserLoginFailed,
      actorId: null,
      entityType: ENTITY_TYPES.USER,
      entityId: "",
      metadata: { email, reason: "unknown_account" },
    });
    return invalid;
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    await emitEvent({
      eventName: EVENT_NAMES.UserLoginFailed,
      actorId: user.id,
      entityType: ENTITY_TYPES.USER,
      entityId: user.id,
      metadata: { reason: "bad_password" },
    });
    return invalid;
  }

  if (!user.isActive) {
    return errorState("هذا الحساب معطَّل. يرجى مراجعة مدير النظام");
  }

  const token = await signSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  });
  await setSessionCookie(token);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await emitEvent({
    eventName: EVENT_NAMES.UserLoggedIn,
    actorId: user.id,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
  });

  redirect(nextPath);
}

/** Only allow same-origin relative redirects to prevent open-redirect abuse. */
function sanitizeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
