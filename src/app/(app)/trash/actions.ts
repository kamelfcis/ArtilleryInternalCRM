"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/current-user";
import { ROLES } from "@/lib/constants";
import {
  restoreFolder,
  restoreDocument,
  purgeDocument,
} from "@/lib/services/trash";

function revalidateTrash() {
  revalidatePath("/trash");
  revalidatePath("/folders");
  revalidatePath("/");
}

/** Restore a folder or document from the recycle bin (managers/admins). */
export async function restoreItemAction(formData: FormData): Promise<void> {
  const user = await requireRole(ROLES.MANAGER);
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!id) return;

  if (kind === "folder") {
    await restoreFolder(id, user.id);
  } else if (kind === "document") {
    await restoreDocument(id, user.id);
  }
  revalidateTrash();
}

/** Permanently delete a document and its files (admins only). */
export async function purgeDocumentAction(formData: FormData): Promise<void> {
  const user = await requireRole(ROLES.ADMIN);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await purgeDocument(id, user.id);
  revalidateTrash();
}
