import { requireRole } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { UsersManager } from "./users-manager";

export const metadata = { title: "المستخدمون" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requireRole(ROLES.ADMIN);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
    },
  });

  return (
    <>
      <PageHeader
        title="إدارة المستخدمين"
        description="إضافة المستخدمين وتحديد أدوارهم وصلاحياتهم"
      />
      <UsersManager
        currentUserId={admin.id}
        users={users.map((u) => ({
          ...u,
          role: u.role as (typeof ROLES)[keyof typeof ROLES],
          lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        }))}
      />
    </>
  );
}
