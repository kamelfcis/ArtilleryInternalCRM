import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { ENTITY_KINDS } from "@/lib/crm/constants";
import { scanForEntity, type ScanKind } from "@/lib/crm/scan";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** OCR + extraction can exceed the default 10s on Vercel. */
export const maxDuration = 60;

/** Max upload accepted for a scan (OCR of anything larger is impractical). */
const MAX_BYTES = 15 * 1024 * 1024;
const SCAN_KINDS = new Set<string>([ENTITY_KINDS.CONTRACT, ENTITY_KINDS.PURCHASE]);

/**
 * POST /api/crm/scan — scan a contract/purchase document and return prefilled
 * form values. EDITOR+ only (same gate as creating the record). The uploaded
 * bytes are used in-memory only; nothing is persisted.
 *
 * multipart/form-data: `file` (image or PDF), `kind` (CONTRACT | PURCHASE).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!hasRoleAtLeast(user.role, ROLES.EDITOR)) {
    return NextResponse.json({ error: "لا تملك صلاحية" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const kind = String(form.get("kind") ?? "");
  if (!SCAN_KINDS.has(kind)) {
    return NextResponse.json({ error: "نوع غير مدعوم" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "لم يُرفق ملف" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "حجم الملف كبير جدًا (الحد 15 ميجابايت)" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await scanForEntity({
      kind: kind as ScanKind,
      buffer,
      filename: file.name,
      mimeType: file.type,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const detail = error instanceof Error ? error.message : String(error);
    if (/wasm|tesseract|ENOENT|Aborted/i.test(detail)) {
      console.error("[crm.scan] OCR engine error", error);
      return NextResponse.json(
        { error: "تعذّر تهيئة التعرف الضوئي على الخادم. أعد المحاولة أو استخدم ملفًا أصغر." },
        { status: 503 },
      );
    }
    console.error("[crm.scan] unexpected error", error);
    return NextResponse.json({ error: "تعذّر تحليل المستند" }, { status: 500 });
  }
}
