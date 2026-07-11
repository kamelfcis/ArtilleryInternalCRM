import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth/session";
import { hasRoleAtLeast, type Role } from "@/lib/constants";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
}

/**
 * Resolve the authenticated user for the current request. The session cookie
 * is verified cryptographically, then the user is re-read from the database so
 * that deactivations and role changes take effect immediately (the JWT alone
 * is not trusted for authorization state). Cached per-request via React cache.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    jobTitle: user.jobTitle,
  };
});

/** Require an authenticated user, redirecting to the login page otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a user whose role is at least as privileged as `minRole`.
 * Redirects unauthenticated users to login and unauthorized users to a
 * dedicated "no access" page.
 */
export async function requireRole(minRole: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRoleAtLeast(user.role, minRole)) redirect("/forbidden");
  return user;
}
