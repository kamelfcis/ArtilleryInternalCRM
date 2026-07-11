"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Wider layout for rich content (e.g. document scanner). */
  wide?: boolean;
}

/**
 * Lightweight accessible modal dialog. Closes on Escape and backdrop click,
 * locks body scroll while open. RTL-aware.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-brand-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className={cn(
        "relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-card border border-line bg-white shadow-overlay",
        wide ? "max-w-2xl" : "max-w-lg",
      )}>
        <div className="flex shrink-0 items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-brand-900">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="btn-ghost -me-2 p-2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
