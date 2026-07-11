import { z } from "zod";
import {
  ALLOWED_EXTENSIONS,
  PERMISSION_LEVEL_ORDER,
  ROLE_ORDER,
} from "@/lib/constants";

/** Reusable Arabic-friendly required-string builder. */
const requiredText = (label: string, max = 200) =>
  z
    .string({ required_error: `${label} مطلوب` })
    .trim()
    .min(1, `${label} مطلوب`)
    .max(max, `${label} طويل جدًا`);

// --- Auth ------------------------------------------------------------------

export const loginSchema = z.object({
  email: z
    .string({ required_error: "البريد الإلكتروني مطلوب" })
    .trim()
    .min(1, "البريد الإلكتروني مطلوب")
    .email("صيغة البريد الإلكتروني غير صحيحة"),
  password: z
    .string({ required_error: "كلمة المرور مطلوبة" })
    .min(1, "كلمة المرور مطلوبة"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// --- Folders ---------------------------------------------------------------

export const folderNameSchema = requiredText("اسم المجلد", 150);

export const createFolderSchema = z.object({
  name: folderNameSchema,
  parentId: z.string().cuid().nullable().optional(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const renameFolderSchema = z.object({
  id: z.string().cuid(),
  name: folderNameSchema,
});

// --- Documents -------------------------------------------------------------

export const documentNameSchema = requiredText("اسم الوثيقة", 200);

export const renameDocumentSchema = z.object({
  id: z.string().cuid(),
  name: documentNameSchema,
});

export const allowedExtensionSchema = z.enum(
  ALLOWED_EXTENSIONS as unknown as [string, ...string[]],
  { errorMap: () => ({ message: "نوع الملف غير مسموح به" }) },
);

// --- Users -----------------------------------------------------------------

export const roleSchema = z.enum(
  ROLE_ORDER as unknown as [string, ...string[]],
  { errorMap: () => ({ message: "الدور غير صالح" }) },
);

export const createUserSchema = z.object({
  name: requiredText("الاسم", 120),
  email: z
    .string()
    .trim()
    .min(1, "البريد الإلكتروني مطلوب")
    .email("صيغة البريد الإلكتروني غير صحيحة"),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  role: roleSchema,
  password: z
    .string()
    .min(8, "كلمة المرور يجب ألا تقل عن ٨ أحرف")
    .max(128, "كلمة المرور طويلة جدًا"),
});

export const updateUserSchema = z.object({
  id: z.string().cuid(),
  name: requiredText("الاسم", 120),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  role: roleSchema,
  isActive: z.boolean(),
});

// --- Permissions -----------------------------------------------------------

export const permissionLevelSchema = z.enum(
  PERMISSION_LEVEL_ORDER as unknown as [string, ...string[]],
  { errorMap: () => ({ message: "مستوى الصلاحية غير صالح" }) },
);

export const grantPermissionSchema = z.object({
  folderId: z.string().cuid(),
  userId: z.string().cuid(),
  level: permissionLevelSchema,
});
