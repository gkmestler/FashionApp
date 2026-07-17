"use client";

import { useCallback, useEffect, useState } from "react";
import { ClothingItem } from "@/lib/types";
import { listItems } from "@/lib/client-api";
import FilterBar, { Filters, EMPTY_FILTERS } from "./FilterBar";
import { Modal, Button, Spinner, EmptyState } from "@/components/ui";

/**
 * The searchable wardrobe picker for a single day. Only ACTIVE items can be
 * selected — washing/retired items are hidden. Tap to add/remove.
 */
export default function ItemPickerModal({
  open,
  onClose,
  selectedIds,
  onToggle,
  dayLabel,
}: {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onToggle: (id: string) => void;
  dayLabel: string;
}) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Force active-only regardless of the filter bar (non-active can't be worn).
      const data = await listItems({
        q: filters.q,
        category: filters.category,
        tag: filters.tag,
        status: "active",
      });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [open, load]);

  return (
    <Modal open={open} onClose={onClose} title={`Add items · ${dayLabel}`} wide>
      <div className="flex flex-col gap-4">
        <FilterBar filters={filters} onChange={setFilters} showStatus={false} />

        {loading ? (
          <div className="flex justify-center py-12 text-muted">
            <Spinner className="h-5 w-5" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No active items match" subtitle="Try clearing filters, or add items in the Wardrobe tab." />
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {items.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => onToggle(item.id)}
                  className={`relative flex flex-col overflow-hidden rounded-xl border-2 bg-surface text-left transition ${
                    selected ? "border-accent" : "border-transparent hover:border-border"
                  }`}
                >
                  <div className="aspect-square bg-[#f4efe8]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-1.5" />
                  </div>
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                  <div className="p-1.5">
                    <p className="truncate text-xs font-medium">{item.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-surface pt-3">
          <span className="text-sm text-muted">{selectedIds.length} selected</span>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
