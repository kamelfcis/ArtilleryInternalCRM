import {
  Building2,
  FolderKanban,
  MapPin,
  Gavel,
  FileSignature,
  ShoppingCart,
  FileText,
  ListChecks,
  ClipboardCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchEntityType } from "@/lib/search/types";

/** Icon + accent color per searchable entity (client-safe, serializable-free). */
export const ENTITY_ICON: Record<
  SearchEntityType,
  { icon: LucideIcon; color: string }
> = {
  COMPANY: { icon: Building2, color: "#8a5a1c" },
  PROJECT: { icon: FolderKanban, color: "#b5912f" },
  SITE: { icon: MapPin, color: "#2f8fb5" },
  PRACTICE: { icon: Gavel, color: "#2f66b5" },
  CONTRACT: { icon: FileSignature, color: "#1c7d5a" },
  PURCHASE: { icon: ShoppingCart, color: "#7a2fb5" },
  DOCUMENT: { icon: FileText, color: "#3a6ea5" },
  TASK: { icon: ListChecks, color: "#b5482f" },
  APPROVAL: { icon: ClipboardCheck, color: "#4f9e3a" },
  USER: { icon: UserRound, color: "#555f6e" },
};

/** Square, tinted entity icon badge used in search result rows. */
export function EntityIcon({
  entityType,
  className,
}: {
  entityType: SearchEntityType;
  className?: string;
}) {
  const { icon: Icon, color } = ENTITY_ICON[entityType];
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        className,
      )}
      style={{ backgroundColor: `${color}18`, color }}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}
