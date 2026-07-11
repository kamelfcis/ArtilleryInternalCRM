"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { markAllRead, markRead } from "@/lib/notifications/service";

/**
 * Server actions behind the notification bell and page. Each authenticates and
 * scopes the mutation to the current user, then revalidates the app layout so
 * the bell's unread badge (rendered in the layout) refreshes.
 */

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) await markRead(user.id, id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
