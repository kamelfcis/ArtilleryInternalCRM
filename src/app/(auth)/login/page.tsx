import type { Metadata } from "next";
import { ShieldCheck, FolderLock, History } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next =
    typeof searchParams.next === "string" && searchParams.next.startsWith("/")
      ? searchParams.next
      : "/";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Branding / value panel (hidden on small screens) */}
      <section className="relative hidden overflow-hidden bg-brand-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #4f83cc 0, transparent 45%), radial-gradient(circle at 80% 60%, #2f66b5 0, transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-3 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm text-brand-100">إدارة المدفعية</p>
            <p className="font-semibold">قسم الاحتياجات</p>
          </div>
        </div>

        <div className="relative text-white">
          <h2 className="text-3xl font-bold leading-snug">
            نظام إدارة الوثائق
            <br />
            وعلاقات الجهات
          </h2>
          <p className="mt-4 max-w-md text-brand-100">
            بيئة عمل موحّدة وآمنة لإدارة الملفات والمجلدات، تحافظ على تنظيمك
            المعتاد مع حماية كاملة وتتبّع دقيق لكل إجراء.
          </p>

          <ul className="mt-8 space-y-4 text-sm text-brand-50">
            <FeatureItem icon={<FolderLock className="h-5 w-5" />}>
              تنظيم هرمي للمجلدات مطابق لطريقة عملكم الحالية
            </FeatureItem>
            <FeatureItem icon={<ShieldCheck className="h-5 w-5" />}>
              صلاحيات دقيقة على مستوى كل مجلد ومستخدم
            </FeatureItem>
            <FeatureItem icon={<History className="h-5 w-5" />}>
              سجل تدقيق كامل وإصدارات محفوظة لكل وثيقة
            </FeatureItem>
          </ul>
        </div>

        <p className="relative text-xs text-brand-200">
          نظام داخلي — الاستخدام مقصور على الموظفين المصرَّح لهم
        </p>
      </section>

      {/* Login form panel */}
      <section className="flex items-center justify-center bg-surface-muted px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
              <ShieldCheck className="h-7 w-7" aria-hidden />
            </div>
            <h1 className="text-lg font-bold text-brand-900">
              نظام إدارة الوثائق
            </h1>
            <p className="text-sm text-slate-500">قسم الاحتياجات</p>
          </div>

          <div className="card p-8">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-brand-900">تسجيل الدخول</h1>
              <p className="mt-1 text-sm text-slate-500">
                أدخل بيانات حسابك للوصول إلى النظام
              </p>
            </div>
            <LoginForm next={next} />
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} إدارة المدفعية — جميع الحقوق محفوظة
          </p>
        </div>
      </section>
    </main>
  );
}

function FeatureItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-brand-100 ring-1 ring-white/15">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}
