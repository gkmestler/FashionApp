"use client";

import { ClothingItem, GeneratedOutfit } from "@/lib/types";
import { PaletteStrip, ZoomableImage, Spinner } from "@/components/ui";

/**
 * A read-only snapshot of an archived look. Archived looks are the originals
 * left behind when a look was re-styled with different items. They can be
 * restored to the active gallery, or deleted for good.
 */
export default function ArchivedLookCard({
  outfit,
  items,
  busy,
  onRestore,
  onDelete,
}: {
  outfit: GeneratedOutfit;
  items: ClothingItem[];
  busy: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        {outfit.palette?.length > 0 ? <PaletteStrip palette={outfit.palette} size={13} /> : <span />}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Archived</span>
      </div>

      <div className="relative aspect-[2/3] bg-[#1a1a17]">
        <ZoomableImage
          src={outfit.image_url}
          alt="Archived look"
          className="h-full w-full object-contain opacity-80"
        />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
            <Spinner className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Items (read-only) */}
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
      </div>

      {outfit.note && (
        <p className="px-3 pb-1 text-[11px] text-muted line-clamp-2">{outfit.note}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
        <button
          onClick={onRestore}
          disabled={busy}
          className="rounded-none border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent-soft disabled:opacity-50"
          title="Move this look back to the active gallery"
        >
          Restore
        </button>
        <button
          onClick={onDelete}
          disabled={busy}
          className="rounded-none px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          title="Delete this look permanently"
        >
          Delete permanently
        </button>
      </div>
    </div>
  );
}
