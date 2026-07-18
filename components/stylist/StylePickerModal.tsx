"use client";

import { useCallback, useEffect, useState } from "react";
import { ClothingItem, GeneratedOutfit } from "@/lib/types";
import { listItems, listOutfits } from "@/lib/client-api";
import { Modal, PaletteStrip, EmptyState, Spinner } from "@/components/ui";

/**
 * Pick a previously-generated outfit ("saved look") for a day. Selecting one
 * sets the day's items to that outfit's items — because the outfit hash is
 * deterministic, the cached image reappears instantly with no regeneration.
 */
export default function StylePickerModal({
  open,
  onClose,
  onPick,
  dayLabel,
  currentHash,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (outfit: GeneratedOutfit) => void;
  dayLabel: string;
  currentHash: string | null;
}) {
  const [outfits, setOutfits] = useState<GeneratedOutfit[]>([]);
  const [itemsMap, setItemsMap] = useState<Map<string, ClothingItem>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [looks, items] = await Promise.all([listOutfits(), listItems({})]);
      setOutfits(looks);
      setItemsMap(new Map(items.map((i) => [i.id, i])));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  const resolveItems = (o: GeneratedOutfit): ClothingItem[] =>
    o.item_ids.map((id) => itemsMap.get(id)).filter((x): x is ClothingItem => !!x);

  return (
    <Modal open={open} onClose={onClose} title={`Saved looks · ${dayLabel}`} wide>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted">
          Tap a look to use it for this day — no need to pick items one by one.
        </p>

        {loading ? (
          <div className="flex justify-center py-12 text-muted">
            <Spinner className="h-5 w-5" />
          </div>
        ) : outfits.length === 0 ? (
          <EmptyState
            title="No saved looks yet"
            subtitle="Generate an outfit for any day and it becomes a reusable look here."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {outfits.map((outfit) => {
              const selected = currentHash === outfit.outfit_hash;
              const items = resolveItems(outfit);
              return (
                <button
                  key={outfit.id}
                  onClick={() => {
                    onPick(outfit);
                    onClose();
                  }}
                  className={`relative flex flex-col overflow-hidden rounded-xl border-2 bg-surface text-left transition ${
                    selected ? "border-accent" : "border-transparent hover:border-border"
                  }`}
                >
                  <div className="relative aspect-[2/3] bg-[#1a1a17]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={outfit.image_url} alt="Saved look" className="h-full w-full object-contain" />
                    {selected && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-none bg-accent text-black">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    {outfit.palette?.length > 0 ? (
                      <PaletteStrip palette={outfit.palette} size={11} />
                    ) : (
                      <span />
                    )}
                    <span className="text-[11px] text-muted">{items.length} items</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
