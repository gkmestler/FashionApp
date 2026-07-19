"use client";

import { useEffect, useRef, useState } from "react";
import { ClothingItem, DAY_NAMES } from "@/lib/types";
import type { DayView } from "@/lib/week-data";
import { buildPalette } from "@/lib/palette";
import { PaletteStrip, Spinner, ZoomableImage } from "@/components/ui";

export type DayGenState = "idle" | "generating" | "error";

export default function DayCard({
  day,
  items,
  genState,
  genError,
  onOpenPicker,
  onOpenLookPicker,
  onRemoveItem,
  onClear,
  onNoteChange,
  onRegenerate,
}: {
  day: DayView;
  items: ClothingItem[]; // resolved, in selection order
  genState: DayGenState;
  genError?: string;
  onOpenPicker: () => void;
  onOpenLookPicker: () => void;
  onRemoveItem: (id: string) => void;
  onClear: () => void;
  onNoteChange: (note: string) => void;
  onRegenerate: () => void;
}) {
  const [note, setNote] = useState(day.note ?? "");
  const firstRender = useRef(true);

  // Keep local note in sync when the week reloads.
  useEffect(() => {
    setNote(day.note ?? "");
  }, [day.id, day.note]);

  // Debounced note save.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (note !== (day.note ?? "")) onNoteChange(note);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  const palette = buildPalette(items.map((i) => ({ colors: i.colors })));
  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <span className="text-sm font-semibold">{DAY_NAMES[day.day_of_week]}</span>
        <div className="flex items-center gap-2">
          {palette.length > 0 && <PaletteStrip palette={palette} size={14} />}
          {hasItems && (
            <button
              onClick={() => {
                if (confirm(`Clear ${DAY_NAMES[day.day_of_week]}'s outfit? The saved look isn't deleted.`)) {
                  onClear();
                }
              }}
              className="text-xs text-muted hover:text-red-600"
              title="Empty this day (keeps the saved look)"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Generated preview — 2:3 matches the generated image so the full figure fits. */}
      <div className="relative aspect-[2/3] bg-[#1a1a17]">
        {genState === "generating" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
            <div className="shimmer absolute inset-0" />
            <Spinner className="relative h-6 w-6" />
            <span className="relative text-xs">Generating…</span>
          </div>
        ) : day.generated_image_url ? (
          <>
            <ZoomableImage src={day.generated_image_url} alt="Generated outfit" className="h-full w-full object-contain" />
            <button
              onClick={onRegenerate}
              className="absolute bottom-2 right-2 z-10 rounded-none bg-black/60 px-2.5 py-1 text-xs font-medium text-white hover:bg-black/80"
              title="Regenerate this outfit"
            >
              ↻ Regenerate
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted">
            {hasItems ? "Not generated yet" : "Add items to build an outfit"}
          </div>
        )}
      </div>

      {genState === "error" && genError && (
        <div className="flex items-center justify-between gap-2 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="truncate">{genError}</span>
          <button onClick={onRegenerate} className="shrink-0 font-medium underline">
            Retry
          </button>
        </div>
      )}

      {/* Selected item thumbnails */}
      <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
        {items.map((item) => (
          <div key={item.id} className="group relative h-11 w-11 overflow-hidden rounded-lg border border-border bg-[#1a1a17]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-0.5" />
            <button
              onClick={() => onRemoveItem(item.id)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
              aria-label={`Remove ${item.name}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={onOpenPicker}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent"
          aria-label="Add items"
        >
          +
        </button>
        <button
          onClick={onOpenLookPicker}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-border text-base text-muted hover:border-accent hover:text-accent"
          aria-label="Use a saved look"
          title="Use a saved look"
        >
          ✨
        </button>
      </div>

      {/* The Wearer's note — read-only context, not part of the prompt. */}
      {day.client_note?.trim() && (
        <div className="mx-3 mb-2 rounded-lg border-l-2 border-accent bg-accent-soft px-2.5 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            From {DAY_NAMES[day.day_of_week]}&apos;s plans
          </div>
          <p className="mt-0.5 text-xs text-foreground/80">{day.client_note}</p>
        </div>
      )}

      {/* Stylist's own note */}
      <div className="px-3 pb-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Styling note (shapes the look)…"
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
