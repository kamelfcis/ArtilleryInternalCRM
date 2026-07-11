"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";
import type { Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface AppShellProps {
  user: { name: string; role: Role; jobTitle: string | null };
  /** Slot in the top bar, left of the user menu (e.g. the notification bell). */
  headerSlot?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Application chrome: a fixed sidebar on desktop, a slide-in drawer on mobile,
 * and a sticky top bar hosting the user menu. Content is rendered in the main
 * region. RTL-aware (sidebar sits on the right).
 */
export function AppShell({ user, headerSlot, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar role={user.role} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-950/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 w-64 shadow-overlay">
            <Sidebar role={user.role} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-screen flex-col">
        <header className="relative sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/80 bg-white/80 px-4 backdrop-blur-md sm:px-6">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-brand-400/40 to-transparent" />
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="فتح القائمة"
            className="btn-ghost -ms-2 p-2 lg:hidden"
          >
            {drawerOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-1">
            {headerSlot}
            <UserMenu
              name={user.name}
              role={user.role}
              jobTitle={user.jobTitle}
            />
          </div>
        </header>

        <main className={cn("relative flex-1 bg-gradient-mesh px-4 py-6 sm:px-6 lg:px-8")}>
          {children}
        </main>
      </div>
    </div>
  );
}
