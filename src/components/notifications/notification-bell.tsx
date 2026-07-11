"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import type { NotificationItem } from "@/lib/notifications/service";
import { markAllNotificationsReadAction } from "@/app/(app)/notifications/actions";
import { timeAgo, toArabicDigits, cn } from "@/lib/utils";

/**
 * Top-bar notification bell. Shows an unread badge and a dropdown of recent
 * notifications. Data is rendered server-side (in the app layout) and passed in
 * as props; mutations go through server actions that revalidate the layout so
 * the badge stays in sync. Delivery is in-app only.
 */
export function NotificationBell({
  items,
  unreadCount,
}: {
  items: NotificationItem[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="الإشعارات"
        className="btn-ghost relative p-2"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "٩+" : toArabicDigits(String(unreadCount))}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-card border border-line bg-white shadow-overlay">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold text-brand-900">
              الإشعارات
            </span>
            {unreadCount > 0 && (
              <form action={markAllNotificationsReadAction}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  تعليم الكل كمقروء
                </button>
              </form>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                لا توجد إشعارات
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const body = (
                    <div
                      className={cn(
                        "flex gap-2.5 px-4 py-3",
                        !n.read && "bg-brand-50/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          n.read ? "bg-transparent" : "bg-brand-500",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-brand-900">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-400">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => setOpen(false)}
                          className="block hover:bg-surface-muted"
                        >
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-2.5 text-center text-sm text-brand-600 hover:bg-surface-muted"
          >
            عرض كل الإشعارات
          </Link>
        </div>
      )}
    </div>
  );
}
