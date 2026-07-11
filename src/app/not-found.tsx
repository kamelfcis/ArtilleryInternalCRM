import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-muted px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        <FileQuestion className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold text-brand-900">الصفحة غير موجودة</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        قد يكون العنصر الذي تبحث عنه قد نُقل أو حُذف، أو أن الرابط غير صحيح.
      </p>
      <Link href="/" className="btn-primary mt-6">
        العودة إلى الرئيسية
      </Link>
    </main>
  );
}
