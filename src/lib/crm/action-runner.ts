import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { uploadDocument } from "@/lib/services/documents";
import {
  errorState,
  fieldErrorState,
  type ActionState,
} from "@/lib/action-result";
import type { CrmEntityConfig } from "@/lib/crm/registry";
import { ENTITY_KIND_META } from "@/lib/crm/constants";

/** The scanned-document file inputs the create dialog may submit. */
const SCAN_FILE_FIELDS = ["scanFileCamera", "scanFileUpload"] as const;

/** Pick the scanned file from either the camera or upload input, if any. */
function pickScanFile(formData: FormData): File | null {
  for (const name of SCAN_FILE_FIELDS) {
    const value = formData.get(name);
    if (value instanceof File && value.size > 0) return value;
  }
  return null;
}

/**
 * Persist a scanned document into the freshly-created record's entity folder so
 * it is reachable under المستندات, and link it back to the record (a confirmed
 * manual link). Best-effort: a failure here never rolls back the created record
 * — it only downgrades the success message. Returns a note for the message.
 */
async function attachScannedDocument(
  config: CrmEntityConfig,
  created: { id: string } & { folderId?: string | null },
  file: File,
  actorId: string,
): Promise<string> {
  if (!created.folderId) return "";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await uploadDocument({
      folderId: created.folderId,
      originalName: file.name,
      buffer,
      declaredMime: file.type || undefined,
      uploadedById: actorId,
      displayName: `${ENTITY_KIND_META[config.kind].labelSingular} ممسوح — ${file.name}`,
    });
    await prisma.documentLink.create({
      data: {
        documentId: doc.id,
        entityType: config.kind,
        entityId: created.id,
        matchedKey: "scan",
        matchedValue: file.name,
        method: "exact",
        confidence: 1,
        status: "CONFIRMED",
        source: "MANUAL",
      },
    });
    return " وحُفظ المستند الممسوح في المستندات";
  } catch (error) {
    console.error("[crm.action] failed to attach scanned document", error);
    return " (تعذّر حفظ المستند الممسوح)";
  }
}

/** Turn a FormData into a plain object of string values (files ignored). */
function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

function toErrorState(error: unknown): ActionState {
  if (error instanceof AppError) return errorState(error.message);
  console.error("[crm.action] unexpected error", error);
  return errorState("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى");
}

function revalidateEntity(config: CrmEntityConfig, id?: string) {
  const base = `/crm/${config.route}`;
  revalidatePath(base);
  if (id) revalidatePath(`${base}/${id}`);
  revalidatePath("/crm");
}

/** Create a record from submitted form data (requires EDITOR+). */
export async function runCreate(
  config: CrmEntityConfig,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("انتهت الجلسة. يرجى تسجيل الدخول");
  if (!hasRoleAtLeast(user.role, ROLES.EDITOR)) {
    return errorState("لا تملك صلاحية الإضافة");
  }

  const parsed = config.schema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  try {
    const created = await config.create(parsed.data, user.id);

    const scanFile = pickScanFile(formData);
    const attachNote = scanFile
      ? await attachScannedDocument(config, created, scanFile, user.id)
      : "";

    revalidateEntity(config, created.id);
    return {
      ok: true,
      message: `تم حفظ ${ENTITY_KIND_META[config.kind].labelSingular} بنجاح${attachNote}`,
    };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Update a record (requires EDITOR+). The record id comes from the form. */
export async function runUpdate(
  config: CrmEntityConfig,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("انتهت الجلسة. يرجى تسجيل الدخول");
  if (!hasRoleAtLeast(user.role, ROLES.EDITOR)) {
    return errorState("لا تملك صلاحية التعديل");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return errorState("معرّف السجل مفقود");

  const parsed = config.schema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  try {
    await config.update(id, parsed.data, user.id);
    revalidateEntity(config, id);
    return { ok: true, message: "تم حفظ التعديلات" };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Soft-delete a record (requires MANAGER+). */
export async function runDelete(
  config: CrmEntityConfig,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("انتهت الجلسة. يرجى تسجيل الدخول");
  if (!hasRoleAtLeast(user.role, ROLES.MANAGER)) {
    return errorState("لا تملك صلاحية الحذف");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return errorState("معرّف السجل مفقود");

  try {
    await config.remove(id, user.id);
    revalidateEntity(config, id);
    return { ok: true, message: "تم الحذف" };
  } catch (error) {
    return toErrorState(error);
  }
}
