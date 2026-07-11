import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderTree,
  Archive,
  Users,
  ScrollText,
  Building2,
  MapPin,
  FolderKanban,
  Gavel,
  FileSignature,
  ShoppingCart,
  ClipboardCheck,
  ListChecks,
  ClipboardList,
  Link2,
  HelpCircle,
} from "lucide-react";
import { ROLES, type Role } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role required to see this item (defaults to any signed-in user). */
  minRole?: Role;
  /** Matched as an exact path (default) or as a prefix. */
  match?: "exact" | "prefix";
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/", label: "لوحة التحكم", icon: LayoutDashboard, match: "exact" },
      {
        href: "/approvals",
        label: "الاعتمادات",
        icon: ClipboardCheck,
        match: "prefix",
      },
      {
        href: "/links/review",
        label: "مراجعة الروابط",
        icon: Link2,
        minRole: ROLES.MANAGER,
        match: "prefix",
      },
    ],
  },
  {
    title: "المهام",
    items: [
      {
        href: "/tasks",
        label: "مهامي",
        icon: ListChecks,
        match: "exact",
      },
      {
        href: "/tasks/manage",
        label: "إدارة المهام",
        icon: ClipboardList,
        minRole: ROLES.MANAGER,
        match: "prefix",
      },
    ],
  },
  {
    title: "إدارة البيانات",
    items: [
      {
        href: "/crm/companies",
        label: "الشركات",
        icon: Building2,
        match: "prefix",
      },
      { href: "/crm/sites", label: "المواقع", icon: MapPin, match: "prefix" },
      {
        href: "/crm/projects",
        label: "المشروعات",
        icon: FolderKanban,
        match: "prefix",
      },
      {
        href: "/crm/practices",
        label: "الممارسات",
        icon: Gavel,
        match: "prefix",
      },
      {
        href: "/crm/contracts",
        label: "التعاقدات",
        icon: FileSignature,
        match: "prefix",
      },
      {
        href: "/crm/purchases",
        label: "المشتريات",
        icon: ShoppingCart,
        match: "prefix",
      },
    ],
  },
  {
    title: "المستندات",
    items: [
      {
        href: "/folders",
        label: "إدارة المستندات",
        icon: FolderTree,
        match: "prefix",
      },
      { href: "/trash", label: "الأرشيف", icon: Archive, match: "prefix" },
    ],
  },
  {
    title: "المساعدة",
    items: [
      {
        href: "/help",
        label: "دليل الاستخدام",
        icon: HelpCircle,
        match: "prefix",
      },
    ],
  },
  {
    title: "الإدارة",
    items: [
      {
        href: "/admin/users",
        label: "إدارة المستخدمين",
        icon: Users,
        minRole: ROLES.ADMIN,
        match: "prefix",
      },
      {
        href: "/admin/audit",
        label: "سجل التدقيق",
        icon: ScrollText,
        minRole: ROLES.ADMIN,
        match: "prefix",
      },
    ],
  },
];
