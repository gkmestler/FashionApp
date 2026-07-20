"use client";

import { useEffect, useRef, useState } from "react";
import { ClothingItem, GeneratedOutfit } from "@/lib/types";
import { PaletteStrip, ZoomableImage, Spinner } from "@/components/ui";

/**
 * A single active saved look. Items can be swapped inline: clicking a
 * thumbnail's × asks for confirmation (a second button), and once confirmed the
 * item is dropped and the (now-stale) image is hidden until the stylist
 * regenerates. Re-adding the same item brings the image straight back — a free
 * undo for accidental removals. Regenerating with a different item set archives
 * the original look (see the API route) instead of destroying it.
 */
export default function LookCard({
  outfit,
  items,
  dirty,
  busy,
  onNoteSave,
  onRegenerate,
  onOpenPicker,
  onRemoveItem,
  onRevertItems,
  onDelete,
}: {
  outfit: GeneratedOutfit;
  items: ClothingItem[]; // resolved DRAFT items, in selection order
  dirty: boolean; // draft item set differs from the saved look
  busy: boolean;
  onNoteSave: (note: string) => void;
  onRegenerate: () => void;
  onOpenPicker: () => void;
  onRemoveItem: (id: string) => void;
  onRevertItems: () => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState(outfit.note ?? "");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
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

  const confirmItem = items.find((i) => i.id === confirmRemoveId) ?? null;
  const canRegenerate = items.length > 0;

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
        {dirty ? (
          // Items changed — the saved image no longer matches, so hide it and
          // prompt a regenerate (or a revert to bring the image back).
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-xs text-muted">
              Items changed — regenerate to see the updated look.
            </p>
            <button
              onClick={onRegenerate}
              disabled={!canRegenerate || busy}
              className="rounded-none bg-accent px-3 py-1.5 text-xs font-medium text-black hover:brightness-95 disabled:opacity-50"
            >
              ↻ Regenerate
            </button>
            {!canRegenerate && (
              <p className="text-[11px] text-muted">Add at least one item first.</p>
            )}
          </div>
        ) : (
          <>
            <ZoomableImage src={outfit.image_url} alt="Saved look" className="h-full w-full object-contain" />
            {!busy && (
              <button
                onClick={onRegenerate}
                className="absolute bottom-2 right-2 z-10 rounded-none bg-black/60 px-2.5 py-1 text-xs font-medium text-white hover:bg-black/80"
                title="Regenerate this look's image"
              >
                ↻ Regenerate
              </button>
            )}
          </>
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
            <Spinner className="h-6 w-6" />
            <span className="text-xs">Generating…</span>
          </div>
        )}
      </div>

      {/* Items — hover a thumbnail to swap it out; "+" adds more. */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
        {items.map((item) => {
          const pending = item.id === confirmRemoveId;
          return (
            <div
              key={item.id}
              className={`group relative h-9 w-9 overflow-hidden rounded-lg border bg-[#1a1a17] ${
                pending ? "border-red-500 ring-1 ring-red-500" : "border-border"
              }`}
              title={item.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-0.5" />
              {!busy && (
                <button
                  onClick={() => setConfirmRemoveId(pending ? null : item.id)}
                  className={`absolute inset-0 flex items-center justify-center text-white transition ${
                    pending
                      ? "bg-red-600/70 opacity-100"
                      : "bg-black/50 opacity-0 group-hover:opacity-100"
                  }`}
                  aria-label={pending ? `Cancel removing ${item.name}` : `Remove ${item.name}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <span className="py-1 text-[11px] text-muted">No items — add some to regenerate</span>
        )}
        <button
          onClick={onOpenPicker}
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent disabled:opacity-50"
          aria-label="Add or swap items"
          title="Add or swap items"
        >
          +
        </button>
      </div>

      {/* Remove confirmation — the "are you sure?" second step. */}
      {confirmItem && (
        <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
          <span className="truncate text-[11px] text-red-700">Remove {confirmItem.name}?</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => {
                onRemoveItem(confirmItem.id);
                setConfirmRemoveId(null);
              }}
              className="rounded-none bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-700"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmRemoveId(null)}
              className="rounded-none px-1.5 py-0.5 text-[11px] text-red-600 hover:text-red-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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

      {/* Footer hint */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
        {dirty ? (
          <>
            <span className="text-[11px] font-medium text-accent">Items changed</span>
            <button
              onClick={onRevertItems}
              disabled={busy}
              className="shrink-0 text-[11px] text-muted underline hover:text-foreground disabled:opacity-50"
            >
              Undo changes
            </button>
          </>
        ) : (
          <span className="text-[11px] text-muted">{outfit.note ? "Note applies on regenerate" : " "}</span>
        )}
      </div>
    </div>
  );
}
