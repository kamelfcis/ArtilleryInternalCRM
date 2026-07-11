import { z } from "zod";
import {
  COMPANY_STATUS,
  PROJECT_STATUS,
  PRACTICE_STATUS,
  CONTRACT_STATUS,
  PURCHASE_STATUS,
} from "@/lib/crm/constants";

/**
 * Zod schemas for CRM entities. Inputs originate from HTML forms, so every
 * value arrives as a string; these helpers normalize empty strings to
 * undefined/null and coerce dates and amounts. Error messages are in Arabic.
 */

const requiredText = (label: string, max = 200) =>
  z
    .string({ required_error: `${label} مطلوب` })
    .transform((v) => v.trim())
    .pipe(z.string().min(1, `${label} مطلوب`).max(max, `${label} طويل جدًا`));

const optionalText = (max = 1000) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : undefined;
    })
    .pipe(z.string().max(max, "النص طويل جدًا").optional());

const optionalId = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : undefined;
  });

const requiredId = (label: string) =>
  z
    .string({ required_error: `${label} مطلوب` })
    .transform((v) => v.trim())
    .pipe(z.string().min(1, `${label} مطلوب`));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.trim();
    if (!t) return null;
    return new Date(t);
  })
  .refine((d) => d === null || !Number.isNaN(d.getTime()), {
    message: "تاريخ غير صحيح",
  });

const optionalAmount = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.trim();
    if (!t) return null;
    return Number(t);
  })
  .refine((n) => n === null || (!Number.isNaN(n) && n >= 0), {
    message: "قيمة غير صحيحة",
  });

const enumWithDefault = (values: readonly string[], def: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : def))
    .pipe(
      z.enum(values as [string, ...string[]], {
        errorMap: () => ({ message: "قيمة غير صالحة" }),
      }),
    );

const CURRENCIES = ["EGP", "USD", "EUR", "SAR"] as const;
const currencyField = enumWithDefault(CURRENCIES, "EGP");

// --- Site ------------------------------------------------------------------

export const siteSchema = z.object({
  name: requiredText("اسم الموقع", 150),
  code: optionalText(50),
  description: optionalText(1000),
  address: optionalText(300),
});

// --- Company ---------------------------------------------------------------

export const companySchema = z.object({
  name: requiredText("اسم الشركة", 200),
  code: optionalText(50),
  contactPerson: optionalText(120),
  phone: optionalText(40),
  email: optionalText(120),
  address: optionalText(300),
  notes: optionalText(2000),
  status: enumWithDefault(Object.values(COMPANY_STATUS), COMPANY_STATUS.ACTIVE),
});

// --- Project ---------------------------------------------------------------

export const projectSchema = z.object({
  name: requiredText("اسم المشروع", 200),
  code: optionalText(50),
  description: optionalText(2000),
  status: enumWithDefault(Object.values(PROJECT_STATUS), PROJECT_STATUS.PLANNED),
  budget: optionalAmount,
  siteId: optionalId,
  startDate: optionalDate,
  endDate: optionalDate,
});

// --- Practice --------------------------------------------------------------

export const practiceSchema = z.object({
  referenceNumber: requiredText("رقم الممارسة", 80),
  title: requiredText("عنوان الممارسة", 250),
  description: optionalText(2000),
  status: enumWithDefault(Object.values(PRACTICE_STATUS), PRACTICE_STATUS.DRAFT),
  estimatedValue: optionalAmount,
  projectId: optionalId,
  awardedCompanyId: optionalId,
  openDate: optionalDate,
  closeDate: optionalDate,
});

// --- Contract --------------------------------------------------------------

export const contractSchema = z.object({
  contractNumber: requiredText("رقم العقد", 80),
  title: requiredText("عنوان العقد", 250),
  description: optionalText(2000),
  status: enumWithDefault(Object.values(CONTRACT_STATUS), CONTRACT_STATUS.DRAFT),
  value: optionalAmount,
  currency: currencyField,
  companyId: requiredId("الشركة"),
  projectId: optionalId,
  practiceId: optionalId,
  signedDate: optionalDate,
  startDate: optionalDate,
  endDate: optionalDate,
});

// --- Purchase --------------------------------------------------------------

export const purchaseSchema = z.object({
  purchaseNumber: requiredText("رقم أمر الشراء", 80),
  title: requiredText("عنوان أمر الشراء", 250),
  description: optionalText(2000),
  status: enumWithDefault(Object.values(PURCHASE_STATUS), PURCHASE_STATUS.REQUESTED),
  amount: optionalAmount,
  currency: currencyField,
  companyId: optionalId,
  projectId: optionalId,
  contractId: optionalId,
  requestDate: optionalDate,
  deliveryDate: optionalDate,
});

export type SiteInput = z.infer<typeof siteSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type PracticeInput = z.infer<typeof practiceSchema>;
export type ContractInput = z.infer<typeof contractSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
