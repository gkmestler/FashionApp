"use client";

import { PaletteEntry } from "@/lib/types";
import { toHex } from "@/lib/palette";
import { ReactNode, useEffect } from "react";

export function PaletteStrip({
  palette,
  size = 20,
  className = "",
}: {
  palette: PaletteEntry[];
  size?: number;
  className?: string;
}) {
  if (!palette || palette.length === 0) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {palette.map((p, i) => (
        <span
          key={`${p.hex}-${i}`}
          title={p.name}
          className="rounded-full border border-black/10 shadow-sm"
          style={{ backgroundColor: p.hex, width: size, height: size }}
        />
      ))}
    </div>
  );
}

/** Palette derived on the fly from a set of color strings (names or hex). */
export function ColorDots({ colors, size = 16 }: { colors: string[]; size?: number }) {
  if (!colors?.length) return null;
  return (
    <div className="flex items-center gap-1">
      {colors.slice(0, 6).map((c, i) => (
        <span
          key={`${c}-${i}`}
          title={c}
          className="rounded-full border border-black/10"
          style={{ backgroundColor: toHex(c), width: size, height: size }}
        />
      ))}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-md"} max-h-[92vh] overflow-y-auto thin-scroll rounded-t-2xl sm:rounded-2xl bg-surface shadow-xl animate-fade-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-3.5">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-muted hover:bg-accent-soft hover:text-foreground"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-accent text-white hover:opacity-90 disabled:opacity-50",
    ghost: "text-muted hover:bg-accent-soft hover:text-foreground",
    outline: "border border-border bg-surface hover:bg-accent-soft",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
