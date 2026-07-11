"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import {
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/action-result";
import {
  ROLE_ORDER,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type Role,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { createUserAction, updateUserAction } from "./actions";

interface UserRow {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
}

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-primary"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          مستخدم جديد
        </button>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs font-medium text-slate-500">
              <th className="px-4 py-3 font-medium">المستخدم</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                الدور
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                آخر دخول
              </th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-muted/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                      {u.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-brand-900">
                        {u.name}
                        {u.id === currentUserId && (
                          <span className="ms-2 text-xs text-slate-400">
                            (أنت)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500" dir="ltr">
                        {u.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 lg:table-cell">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                </td>
                <td className="px-4 py-3">
                  {u.isActive ? (
                    <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                      نشط
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      معطَّل
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => setEditing(u)}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    تعديل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateUserModal open onClose={() => setCreating(false)} />
      )}
      {editing && (
        <EditUserModal
          open
          onClose={() => setEditing(null)}
          user={editing}
          isSelf={editing.id === currentUserId}
        />
      )}
    </div>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.ok && state.message) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </div>
    );
  }
  if (!state.ok && state.message) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </div>
    );
  }
  return null;
}

function RoleSelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: Role;
}) {
  return (
    <select
      id={name}
      name={name}
      defaultValue={defaultValue ?? "VIEWER"}
      className="field-input"
    >
      {ROLE_ORDER.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]} — {ROLE_DESCRIPTIONS[role]}
        </option>
      ))}
    </select>
  );
}

function CreateUserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, action] = useFormState(createUserAction, initialActionState);
  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onClose, 700);
      return () => clearTimeout(t);
    }
  }, [state.ok, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="إضافة مستخدم جديد">
      <form action={action} className="space-y-4">
        <Field label="الاسم" name="name" error={state.fieldErrors?.name} autoFocus />
        <Field
          label="البريد الإلكتروني"
          name="email"
          type="email"
          dir="ltr"
          error={state.fieldErrors?.email}
        />
        <Field
          label="المسمى الوظيفي (اختياري)"
          name="jobTitle"
          error={state.fieldErrors?.jobTitle}
        />
        <div>
          <label htmlFor="role" className="field-label">
            الدور
          </label>
          <RoleSelect name="role" />
        </div>
        <Field
          label="كلمة المرور المبدئية"
          name="password"
          type="password"
          error={state.fieldErrors?.password}
        />
        <Feedback state={state} />
        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton pendingLabel="جارٍ الإنشاء…">إنشاء</SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({
  open,
  onClose,
  user,
  isSelf,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow;
  isSelf: boolean;
}) {
  const [state, action] = useFormState(updateUserAction, initialActionState);
  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onClose, 700);
      return () => clearTimeout(t);
    }
  }, [state.ok, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="تعديل المستخدم">
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={user.id} />
        <Field
          label="الاسم"
          name="name"
          defaultValue={user.name}
          error={state.fieldErrors?.name}
        />
        <div>
          <label className="field-label">البريد الإلكتروني</label>
          <p className="rounded-lg bg-surface-muted px-3.5 py-2.5 text-sm text-slate-500" dir="ltr">
            {user.email}
          </p>
        </div>
        <Field
          label="المسمى الوظيفي (اختياري)"
          name="jobTitle"
          defaultValue={user.jobTitle ?? ""}
        />
        <div>
          <label htmlFor="role" className="field-label">
            الدور
          </label>
          <RoleSelect name="role" defaultValue={user.role} />
          {isSelf && (
            <p className="mt-1 text-xs text-amber-600">
              لا يمكنك تغيير دورك أو تعطيل حسابك الخاص.
            </p>
          )}
        </div>
        {/* A disabled checkbox does not submit; for self-editing we force the
            account to remain active via a hidden field. */}
        {isSelf && <input type="hidden" name="isActive" value="true" />}
        <label className="flex items-center gap-2 text-sm text-brand-900">
          <input
            type="checkbox"
            name={isSelf ? undefined : "isActive"}
            defaultChecked={user.isActive}
            disabled={isSelf}
            className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-400"
          />
          الحساب نشط
        </label>
        <Feedback state={state} />
        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ</SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  error,
  dir,
  autoFocus,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  error?: string[];
  dir?: "ltr" | "rtl";
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        dir={dir}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        className="field-input"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error[0]}</p>}
    </div>
  );
}
