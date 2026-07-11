import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "لا تملك صلاحية" };

export default function ForbiddenPage() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="لا تملك صلاحية الوصول"
      description="هذه الصفحة مخصّصة لصلاحيات أعلى. إذا كنت تعتقد أن هذا خطأ، يرجى مراجعة مدير النظام."
      action={
        <Link href="/" className="btn-primary">
          العودة إلى الرئيسية
        </Link>
      }
    />
  );
}
