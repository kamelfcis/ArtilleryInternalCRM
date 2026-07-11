"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserCircle2 } from "lucide-react";
import { logoutAction } from "@/app/(app)/actions";
import { ROLE_LABELS, type Role } from "@/lib/constants";

interface UserMenuProps {
  name: string;
  role: Role;
  jobTitle: string | null;
}

/** Accessible avatar dropdown with the sign-out action. */
export function UserMenu({ name, role, jobTitle }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initials = name.trim().charAt(0) || "؟";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg py-1.5 pe-2 ps-1.5 text-sm hover:bg-surface-muted"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-right sm:block">
          <span className="block font-medium text-brand-900">{name}</span>
          <span className="block text-xs text-slate-500">
            {jobTitle || ROLE_LABELS[role]}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-overlay"
        >
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <UserCircle2 className="h-9 w-9 text-brand-500" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-900">
                {name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {ROLE_LABELS[role]}
              </p>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              تسجيل الخروج
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
