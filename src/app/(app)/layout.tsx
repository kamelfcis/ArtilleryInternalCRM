import { requireUser } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearch } from "@/components/search/global-search";
import { listNotifications, unreadCount } from "@/lib/notifications/service";

/**
 * Authenticated area layout. Guarantees a signed-in user (redirecting to the
 * login page otherwise) and wraps all pages in the application chrome. The
 * notification bell is rendered here so its unread badge is available on every
 * page and refreshes when a mark-read action revalidates the layout.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const [notifications, unread] = await Promise.all([
    listNotifications(user.id, 10),
    unreadCount(user.id),
  ]);

  return (
    <AppShell
      user={{ name: user.name, role: user.role, jobTitle: user.jobTitle }}
      headerSlot={
        <>
          <GlobalSearch />
          <NotificationBell items={notifications} unreadCount={unread} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
