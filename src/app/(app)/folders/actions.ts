"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/current-user";
import { canEdit, canManage, roleBaselineLevel } from "@/lib/authz";
import {
  createFolder,
  renameFolder,
  softDeleteFolder,
} from "@/lib/services/folders";
import {
  uploadDocument,
  renameDocument,
  softDeleteDocument,
} from "@/lib/services/documents";
import {
  createFolderSchema,
  renameFolderSchema,
  renameDocumentSchema,
} from "@/lib/validators";
import { AppError } from "@/lib/errors";
import { PERMISSION_LEVELS } from "@/lib/constants";
import {
  errorState,
  fieldErrorState,
  type ActionState,
} from "@/lib/action-result";

/** Revalidate the affected folder view(s). */
function revalidateFolder(folderId: string | null) {
  revalidatePath("/folders");
  if (folderId) revalidatePath(`/folders/${folderId}`);
  revalidatePath("/trash");
  revalidatePath("/");
}

/** Load a folder's id+path or return null when missing/deleted. */
async function loadFolder(id: string) {
  return prisma.folder.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, path: true, parentId: true, isSystem: true },
  });
}

/** Convert a thrown error into a user-facing ActionState. */
function toErrorState(error: unknown): ActionState {
  if (error instanceof AppError) return errorState(error.message);
  console.error("[folders.action] unexpected error", error);
  return errorState("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى");
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function createFolderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const rawParent = formData.get("parentId");
  const parsed = createFolderSchema.safeParse({
    name: formData.get("name"),
    parentId: rawParent ? String(rawParent) : null,
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  const parentId = parsed.data.parentId ?? null;

  try {
    // Authorization: creating a top-level folder requires MANAGE at root
    // (managers/admins); otherwise EDIT on the parent folder.
    if (!parentId) {
      const level = roleBaselineLevel(user.role);
      if (level !== PERMISSION_LEVELS.MANAGE) {
        return errorState("لا تملك صلاحية إنشاء مجلد رئيسي");
      }
    } else {
      const parent = await loadFolder(parentId);
      if (!parent) return errorState("المجلد الأصل غير موجود");
      if (!(await canEdit(user, parent))) {
        return errorState("لا تملك صلاحية الإضافة في هذا المجلد");
      }
    }

    await createFolder({
      name: parsed.data.name,
      parentId,
      description: parsed.data.description || null,
      createdById: user.id,
    });
    revalidateFolder(parentId);
    return { ok: true, message: "تم إنشاء المجلد بنجاح" };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function renameFolderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = renameFolderSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  try {
    const folder = await loadFolder(parsed.data.id);
    if (!folder) return errorState("المجلد غير موجود");
    if (folder.isSystem)
      return errorState("لا يمكن إعادة تسمية المجلدات الأساسية");
    if (!(await canManage(user, folder))) {
      return errorState("لا تملك صلاحية إعادة تسمية هذا المجلد");
    }

    await renameFolder(parsed.data.id, parsed.data.name, user.id);
    revalidateFolder(folder.parentId);
    revalidatePath(`/folders/${folder.id}`);
    return { ok: true, message: "تم تحديث الاسم" };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function deleteFolderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return errorState("معرّف المجلد مفقود");

  const returnToParent = formData.get("returnToParent") === "1";
  let redirectTo: string | undefined;

  try {
    const folder = await loadFolder(id);
    if (!folder) return errorState("المجلد غير موجود");
    if (folder.isSystem) {
      return errorState("لا يمكن حذف المجلدات الأساسية للنظام");
    }
    if (!(await canManage(user, folder))) {
      return errorState("لا تملك صلاحية حذف هذا المجلد");
    }
    await softDeleteFolder(id, user.id);
    revalidateFolder(folder.parentId);

    if (returnToParent) {
      redirectTo = folder.parentId ? `/folders/${folder.parentId}` : "/folders";
    }
  } catch (error) {
    return toErrorState(error);
  }

  if (redirectTo) redirect(redirectTo);
  return { ok: true, message: "تم نقل المجلد إلى المحذوفات" };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function uploadDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const folderId = String(formData.get("folderId") ?? "");
  if (!folderId) return errorState("المجلد غير محدد");

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return errorState("لم يتم اختيار أي ملف");

  try {
    const folder = await loadFolder(folderId);
    if (!folder) return errorState("المجلد غير موجود");
    if (!(await canEdit(user, folder))) {
      return errorState("لا تملك صلاحية رفع ملفات في هذا المجلد");
    }

    let uploaded = 0;
    const failures: string[] = [];
    const displayNames = formData
      .getAll("displayNames")
      .map((v) => (typeof v === "string" ? v.trim() : ""));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        await uploadDocument({
          folderId,
          originalName: file.name,
          displayName: displayNames[i] || undefined,
          buffer,
          declaredMime: file.type || undefined,
          uploadedById: user.id,
        });
        uploaded += 1;
      } catch (error) {
        failures.push(
          `${file.name}: ${
            error instanceof AppError ? error.message : "فشل الرفع"
          }`,
        );
      }
    }

    revalidateFolder(folderId);

    if (uploaded === 0) {
      return errorState(failures.join(" — ") || "تعذّر رفع الملفات");
    }
    return {
      ok: true,
      message: failures.length
        ? `تم رفع ${uploaded} ملف، مع تعذّر: ${failures.join(" — ")}`
        : `تم رفع ${uploaded} ملف بنجاح`,
    };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function renameDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = renameDocumentSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  try {
    const doc = await prisma.document.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
      select: { id: true, folder: { select: { id: true, path: true } } },
    });
    if (!doc) return errorState("الوثيقة غير موجودة");
    if (!(await canEdit(user, doc.folder))) {
      return errorState("لا تملك صلاحية تعديل هذه الوثيقة");
    }
    await renameDocument(parsed.data.id, parsed.data.name, user.id);
    revalidateFolder(doc.folder.id);
    return { ok: true, message: "تم تحديث اسم الوثيقة" };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function deleteDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return errorState("معرّف الوثيقة مفقود");

  try {
    const doc = await prisma.document.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, folder: { select: { id: true, path: true } } },
    });
    if (!doc) return errorState("الوثيقة غير موجودة");
    if (!(await canManage(user, doc.folder))) {
      return errorState("لا تملك صلاحية حذف هذه الوثيقة");
    }
    await softDeleteDocument(id, user.id);
    revalidateFolder(doc.folder.id);
    return { ok: true, message: "تم نقل الوثيقة إلى المحذوفات" };
  } catch (error) {
    return toErrorState(error);
  }
}
