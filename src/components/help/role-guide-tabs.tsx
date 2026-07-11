"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LayoutList, Route } from "lucide-react";
import type { Role } from "@/lib/constants";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  ROLE_GUIDES,
  ROLE_TAB_ORDER,
  roleTabLabel,
} from "./guide-content";

const DETAILED_ROLES: Role[] = [ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN];

export function RoleGuideTabs() {
  const [active, setActive] = useState<Role>(ROLES.VIEWER);
  const guide = ROLE_GUIDES.find((g) => g.role === active)!;
  const isDetailed = DETAILED_ROLES.includes(active);

  return (
    <div className="rounded-card border border-line bg-white shadow-card">
      <div
        role="tablist"
        aria-label="أدوار المستخدمين"
        className="flex flex-wrap gap-1 border-b border-line p-2"
      >
        {ROLE_TAB_ORDER.map((role) => {
          const selected = active === role;
          return (
            <button
              key={role}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(role)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                selected
                  ? "bg-brand-600 text-white"
                  : "text-slate-600 hover:bg-surface-muted hover:text-brand-900",
              )}
            >
              {roleTabLabel(role)}
              {!DETAILED_ROLES.includes(role) && (
                <span className="me-1 text-xs opacity-70">(مختصر)</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="p-5 sm:p-6">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-brand-900">
            {ROLE_LABELS[active]}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{guide.summary}</p>
        </div>

        <div
          className={cn(
            "grid gap-5",
            isDetailed ? "lg:grid-cols-3" : "lg:grid-cols-2",
          )}
        >
          <section className="rounded-lg border border-line bg-surface-muted/40 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900">
              <CheckCircle2 className="h-4 w-4 text-brand-600" aria-hidden />
              ما يمكنك فعله
            </h4>
            <ul className="space-y-2">
              {guide.capabilities.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm text-slate-600 before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-brand-400"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-line bg-surface-muted/40 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900">
              <LayoutList className="h-4 w-4 text-brand-600" aria-hidden />
              الصفحات الرئيسية
            </h4>
            <ul className="space-y-2">
              {guide.pages.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
                  >
                    {page.label}
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {isDetailed && (
            <section className="rounded-lg border border-line bg-surface-muted/40 p-4 lg:col-span-1">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900">
                <Route className="h-4 w-4 text-brand-600" aria-hidden />
                سير العمل اليومي
              </h4>
              <ol className="space-y-2">
                {guide.workflow.map((step, idx) => (
                  <li
                    key={step}
                    className="flex gap-3 text-sm text-slate-600"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                      {idx + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {!isDetailed && (
          <section className="mt-5 rounded-lg border border-line bg-surface-muted/40 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900">
              <Route className="h-4 w-4 text-brand-600" aria-hidden />
              سير العمل اليومي
            </h4>
            <ol className="space-y-2">
              {guide.workflow.map((step, idx) => (
                <li key={step} className="flex gap-3 text-sm text-slate-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
