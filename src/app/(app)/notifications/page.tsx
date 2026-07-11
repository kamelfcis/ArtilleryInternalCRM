import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/ui/page-header";
import { listNotifications, unreadCount } from "@/lib/notifications/service";
import { formatDateTime, cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";

export const dynamic = "force-dynamic";

/** Full notification history for the signed-in user. */
export default async function NotificationsPage() {
  const user = await requireUser();

  const [items, unread] = await Promise.all([
    listNotifications(user.id, 50),
    unreadCount(user.id),
  ]);

  return (
    <>
      <PageHeader title="الإشعارات" description="كل الإشعارات الخاصة بك" />

      {unread > 0 && (
        <div className="mb-3 flex justify-start">
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="btn-secondary">
              <Check className="h-4 w-4" aria-hidden />
              تعليم الكل كمقروء
            </button>
          </form>
        </div>
      )}

      <div className="rounded-card border border-line bg-white p-2 shadow-card">
        {items.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-slate-400">
            لا توجد إشعارات
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-3 px-3 py-3.5",
                  !n.read && "bg-brand-50/40",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    n.read ? "bg-slate-200" : "bg-brand-500",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-brand-900">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {n.link && (
                    <Link
                      href={n.link}
                      className="btn-ghost p-2"
                      aria-label="فتح العنصر"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </Link>
                  )}
                  {!n.read && (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        className="btn-ghost p-2"
                        aria-label="تعليم كمقروء"
                      >
                        <Check className="h-4 w-4" aria-hidden />
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
