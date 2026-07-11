"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { NAV_SECTIONS } from "./nav-config";
import { hasRoleAtLeast, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: Role;
  onNavigate?: () => void;
}

function isActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix" = "exact",
): boolean {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="flex h-full flex-col bg-brand-900 text-brand-100"
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">إدارة الوثائق</p>
          <p className="text-xs text-brand-300">قسم الاحتياجات</p>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section, idx) => {
          const items = section.items.filter(
            (item) => !item.minRole || hasRoleAtLeast(role, item.minRole),
          );
          if (items.length === 0) return null;
          return (
            <div key={section.title ?? idx}>
              {section.title && (
                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-brand-400">
                  {section.title}
                </p>
              )}
              <ul className="space-y-1">
                {items.map((item) => {
                  const active = isActive(pathname, item.href, item.match);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-white/10 text-white"
                            : "text-brand-200 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-brand-400">
        الإصدار ١٫٠ — نظام داخلي
      </div>
    </nav>
  );
}
