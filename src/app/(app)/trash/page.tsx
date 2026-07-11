import { Trash2, RotateCcw, Folder as FolderIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/current-user";
import { ROLES } from "@/lib/constants";
import { listTrash } from "@/lib/services/trash";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentIcon } from "@/components/ui/file-icon";
import { formatDateTime, formatFileSize } from "@/lib/utils";
import { restoreItemAction, purgeDocumentAction } from "./actions";
import { PurgeButton } from "./purge-button";

export const metadata = { title: "الأرشيف" };
export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const user = await requireRole(ROLES.MANAGER);
  const items = await listTrash();
  const isAdmin = user.role === ROLES.ADMIN;

  return (
    <>
      <PageHeader
        title="الأرشيف"
        description="العناصر المحذوفة يمكن استعادتها إلى مواقعها الأصلية"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="الأرشيف فارغ"
          description="لا توجد عناصر محذوفة حاليًا."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-right text-xs font-medium text-slate-500">
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  النوع
                </th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  تاريخ الحذف
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={`${item.kind}-${item.id}`} className="hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.kind === "folder" ? (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                          <FolderIcon className="h-5 w-5" aria-hidden />
                        </span>
                      ) : (
                        <DocumentIcon extension={item.extension ?? null} />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-brand-900">
                          {item.name}
                        </p>
                        {item.kind === "document" &&
                          typeof item.size === "number" && (
                            <p className="text-xs text-slate-400">
                              {formatFileSize(item.size)}
                            </p>
                          )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                    {item.kind === "folder" ? "مجلد" : "وثيقة"}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 lg:table-cell">
                    {formatDateTime(item.deletedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <form action={restoreItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="kind" value={item.kind} />
                        <button
                          type="submit"
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                          استعادة
                        </button>
                      </form>
                      {isAdmin && item.kind === "document" && (
                        <PurgeButton id={item.id} action={purgeDocumentAction} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
