"use client";

import { useEffect, useRef, useState } from "react";
import { ClothingItem, GeneratedOutfit } from "@/lib/types";
import { PaletteStrip, ZoomableImage, Spinner } from "@/components/ui";

/**
 * A single saved look. Supports editing its note (fed into the prompt on
 * regenerate), editing its items, regenerating the image, and deleting.
 */
export default function LookCard({
  outfit,
  items,
  busy,
  onNoteSave,
  onRegenerate,
  onEditItems,
  onDelete,
}: {
  outfit: GeneratedOutfit;
  items: ClothingItem[];
  busy: boolean;
  onNoteSave: (note: string) => void;
  onRegenerate: () => void;
  onEditItems: () => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState(outfit.note ?? "");
  const firstRender = useRef(true);

  // Keep local note in sync when the gallery reloads.
  useEffect(() => {
    setNote(outfit.note ?? "");
  }, [outfit.id, outfit.note]);

  // Debounced note save.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (note !== (outfit.note ?? "")) onNoteSave(note);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        {outfit.palette?.length > 0 ? <PaletteStrip palette={outfit.palette} size={13} /> : <span />}
        <button
          onClick={onDelete}
          disabled={busy}
          className="rounded-none p-1 text-muted transition hover:text-red-600 disabled:opacity-50"
          aria-label="Delete look"
          title="Delete look"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>

      <div className="relative aspect-[2/3] bg-[#1a1a17]">
        <ZoomableImage src={outfit.image_url} alt="Saved look" className="h-full w-full object-contain" />
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
            <Spinner className="h-6 w-6" />
            <span className="text-xs">Generating…</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="h-9 w-9 overflow-hidden rounded-lg border border-border bg-[#1a1a17]"
            title={item.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-0.5" />
          </div>
        ))}
        {items.length === 0 && (
          <span className="py-1 text-[11px] text-muted">Items no longer in wardrobe</span>
        )}
        <button
          onClick={onEditItems}
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent disabled:opacity-50"
          aria-label="Edit items"
          title="Edit items"
        >
          +
        </button>
      </div>

      {/* Note */}
      <div className="px-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Styling note (e.g. tuck in the shirt)…"
          rows={2}
          disabled={busy}
          className="w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-50"
        />
      </div>

      {/* Regenerate */}
      <div className="flex items-center justify-between px-3 pb-3 pt-2">
        <span className="text-[11px] text-muted">
          {outfit.note ? "Note applies on regenerate" : " "}
        </span>
        <button
          onClick={onRegenerate}
          disabled={busy}
          className="rounded-none border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent-soft disabled:opacity-50"
          title="Regenerate this look's image"
        >
          ↻ Regenerate
        </button>
      </div>
    </div>
  );
}
