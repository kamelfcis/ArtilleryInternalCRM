import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileType,
  File as FileIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Style {
  icon: LucideIcon;
  className: string;
}

const STYLES: Record<string, Style> = {
  pdf: { icon: FileType, className: "text-red-600 bg-red-50" },
  doc: { icon: FileText, className: "text-blue-600 bg-blue-50" },
  docx: { icon: FileText, className: "text-blue-600 bg-blue-50" },
  xls: { icon: FileSpreadsheet, className: "text-green-600 bg-green-50" },
  xlsx: { icon: FileSpreadsheet, className: "text-green-600 bg-green-50" },
  ppt: { icon: FileText, className: "text-orange-600 bg-orange-50" },
  pptx: { icon: FileText, className: "text-orange-600 bg-orange-50" },
  png: { icon: FileImage, className: "text-purple-600 bg-purple-50" },
  jpg: { icon: FileImage, className: "text-purple-600 bg-purple-50" },
  jpeg: { icon: FileImage, className: "text-purple-600 bg-purple-50" },
  txt: { icon: FileText, className: "text-slate-600 bg-slate-100" },
};

const FALLBACK: Style = { icon: FileIcon, className: "text-slate-500 bg-slate-100" };

export function DocumentIcon({
  extension,
  className,
}: {
  extension: string | null;
  className?: string;
}) {
  const style = (extension && STYLES[extension]) || FALLBACK;
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg",
        style.className,
        className,
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}
