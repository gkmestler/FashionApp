"use client";

import { useCallback, useEffect, useState } from "react";
import { ClothingItem, GeneratedOutfit } from "@/lib/types";
import { listItems, listOutfits, deleteOutfit } from "@/lib/client-api";
import { PaletteStrip, ZoomableImage, EmptyState, Spinner } from "@/components/ui";

/**
 * The "Looks" tab: every outfit the stylist has ever generated, saved as a
 * reusable style. Cards can be deleted (removes the image + row) and are the
 * source the day-builder pulls from when applying a saved look.
 */
export default function StyleGallery({ refreshKey }: { refreshKey: number }) {
  const [outfits, setOutfits] = useState<GeneratedOutfit[]>([]);
  const [itemsMap, setItemsMap] = useState<Map<string, ClothingItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [looks, items] = await Promise.all([listOutfits(), listItems({})]);
      setOutfits(looks);
      setItemsMap(new Map(items.map((i) => [i.id, i])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load saved looks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function remove(outfit: GeneratedOutfit) {
    if (!confirm("Delete this look? It will disappear from any day that uses it.")) return;
    setDeletingId(outfit.id);
    // Optimistic removal.
    setOutfits((prev) => prev.filter((o) => o.id !== outfit.id));
    try {
      await deleteOutfit(outfit.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      load(); // put it back if the server rejected it
    } finally {
      setDeletingId(null);
    }
  }

  const resolveItems = (o: GeneratedOutfit): ClothingItem[] =>
    o.item_ids.map((id) => itemsMap.get(id)).filter((x): x is ClothingItem => !!x);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold">Saved looks</h2>
          <p className="text-xs text-muted">
            Every outfit you&apos;ve generated. Reuse one on a day from the Week tab.
          </p>
        </div>
        {outfits.length > 0 && <span className="text-xs text-muted">{outfits.length} saved</span>}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : outfits.length === 0 ? (
        <EmptyState
          title="No saved looks yet"
          subtitle="Generate outfits in the Week tab and they'll be saved here as reusable styles."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {outfits.map((outfit) => {
            const items = resolveItems(outfit);
            return (
              <div
                key={outfit.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  {outfit.palette?.length > 0 ? (
                    <PaletteStrip palette={outfit.palette} size={13} />
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => remove(outfit)}
                    disabled={deletingId === outfit.id}
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
                  <ZoomableImage
                    src={outfit.image_url}
                    alt="Saved look"
                    className="h-full w-full object-contain"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
