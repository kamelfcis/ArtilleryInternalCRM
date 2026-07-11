"use server";

import { redirect } from "next/navigation";
import { readSession, clearSessionCookie } from "@/lib/auth/session";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import { ENTITY_TYPES } from "@/lib/constants";

/** Sign the current user out and return them to the login screen. */
export async function logoutAction(): Promise<void> {
  const session = await readSession();
  if (session) {
    await emitEvent({
      eventName: EVENT_NAMES.UserLoggedOut,
      actorId: session.sub,
      entityType: ENTITY_TYPES.USER,
      entityId: session.sub,
    });
  }
  await clearSessionCookie();
  redirect("/login");
}
