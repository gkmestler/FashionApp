"use client";

import { PaletteEntry } from "@/lib/types";
import { toHex } from "@/lib/palette";
import { ReactNode, useEffect, useRef, useState } from "react";

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
          className="rounded-full border border-white/15 shadow-sm"
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
          className="rounded-full border border-white/15"
          style={{ backgroundColor: toHex(c), width: size, height: size }}
        />
      ))}
    </div>
  );
}

/**
 * A round color swatch backed by a native color picker. Shows the actual color
 * (resolving names like "navy" to hex) and opens the OS picker on click. Used to
 * pick a new color or change an existing color tag.
 */
export function ColorSwatchPicker({
  value,
  onChange,
  size = 18,
  title,
}: {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
  title?: string;
}) {
  const hex = toHex(value);
  return (
    <span
      className="relative inline-block shrink-0 align-middle"
      style={{ width: size, height: size }}
      title={title ?? "Pick a color"}
    >
      <span
        className="block h-full w-full rounded-full border border-white/15 shadow-sm"
        style={{ backgroundColor: hex }}
      />
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        aria-label={title ?? "Pick a color"}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
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
              className="rounded-none p-1.5 text-muted hover:bg-accent-soft hover:text-foreground"
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

/**
 * An image that opens a full-screen, zoomable/pannable lightbox on click.
 * The trigger keeps whatever classes you pass (so it drops into existing
 * layouts); `object-contain` on the trigger ensures nothing is cropped in place.
 */
export function ZoomableImage({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        className={`cursor-zoom-in ${className}`}
      />
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setZoom = (next: number) => {
    const s = Math.min(6, Math.max(1, next));
    setScale(s);
    if (s === 1) setPos({ x: 0, y: 0 });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (scale <= 1) return;
    drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!drag.current) return;
    setPos({ x: drag.current.ox + (e.clientX - drag.current.px), y: drag.current.oy + (e.clientY - drag.current.py) });
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const btn =
    "flex h-9 w-9 items-center justify-center border border-white/20 bg-black/50 text-lg text-white hover:bg-white/15";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div className="absolute right-4 top-4 z-10 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button className={btn} onClick={() => setZoom(scale - 0.5)} aria-label="Zoom out" title="Zoom out">
          −
        </button>
        <button className={btn} onClick={() => setZoom(scale + 0.5)} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button className={btn} onClick={() => setZoom(1)} aria-label="Reset zoom" title="Reset">
          ⤢
        </button>
        <button className={btn} onClick={onClose} aria-label="Close" title="Close">
          ✕
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={() => setZoom(scale > 1 ? 1 : 2.5)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        draggable={false}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
        }}
        className="max-h-[90vh] max-w-[92vw] touch-none select-none object-contain transition-transform duration-100"
      />
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
    primary: "bg-accent text-black hover:opacity-90 disabled:opacity-50",
    ghost: "text-muted hover:bg-accent-soft hover:text-foreground",
    outline: "border border-border bg-surface hover:bg-accent-soft",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-none px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
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
