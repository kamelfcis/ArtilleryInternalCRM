import "server-only";
import { prisma } from "@/lib/prisma";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import { hashPassword } from "@/lib/auth/password";
import { ENTITY_TYPES, type Role } from "@/lib/constants";
import { ConflictError, NotFoundError } from "@/lib/errors";

interface CreateUserInput {
  name: string;
  email: string;
  jobTitle?: string | null;
  role: Role;
  password: string;
  actorId: string;
}

/** Create a new system user. */
export async function createUser(input: CreateUserInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError("يوجد مستخدم مسجَّل بنفس البريد الإلكتروني");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      jobTitle: input.jobTitle?.trim() || null,
      role: input.role,
      passwordHash,
    },
    select: { id: true, name: true, email: true },
  });

  await emitEvent({
    eventName: EVENT_NAMES.UserCreated,
    actorId: input.actorId,
    entityType: ENTITY_TYPES.USER,
    entityId: user.id,
    metadata: { name: user.name, role: input.role },
  });

  return user;
}

interface UpdateUserInput {
  id: string;
  name: string;
  jobTitle?: string | null;
  role: Role;
  isActive: boolean;
  actorId: string;
}

/** Update a user's profile, role and active state. */
export async function updateUser(input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({
    where: { id: input.id },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!existing) throw new NotFoundError("المستخدم غير موجود");

  await prisma.user.update({
    where: { id: input.id },
    data: {
      name: input.name.trim(),
      jobTitle: input.jobTitle?.trim() || null,
      role: input.role,
      isActive: input.isActive,
    },
  });

  // One write → exactly one event; the most specific name is chosen.
  const eventName = !input.isActive
    ? EVENT_NAMES.UserDeleted
    : input.role !== existing.role
      ? EVENT_NAMES.UserRoleChanged
      : EVENT_NAMES.UserUpdated;

  await emitEvent({
    eventName,
    actorId: input.actorId,
    entityType: ENTITY_TYPES.USER,
    entityId: input.id,
    metadata: {
      name: input.name,
      role: input.role,
      isActive: input.isActive,
      previousRole: existing.role,
    },
  });
}

/** Reset a user's password to a new value (admin action). */
export async function resetUserPassword(
  id: string,
  newPassword: string,
  actorId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!user) throw new NotFoundError("المستخدم غير موجود");

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await emitEvent({
    eventName: EVENT_NAMES.UserPasswordChanged,
    actorId,
    entityType: ENTITY_TYPES.USER,
    entityId: id,
    metadata: { name: user.name, passwordReset: true },
  });
}
