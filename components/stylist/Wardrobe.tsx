"use client";

import { useCallback, useEffect, useState } from "react";
import { ClothingItem } from "@/lib/types";
import { listItems, updateItem, deleteItem } from "@/lib/client-api";
import FilterBar, { Filters, EMPTY_FILTERS } from "./FilterBar";
import ItemForm, { ItemFormValues } from "./ItemForm";
import { Modal, Button, ColorDots, EmptyState, Spinner } from "@/components/ui";

export default function Wardrobe({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClothingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listItems({
        q: filters.q,
        category: filters.category,
        status: filters.status,
        tag: filters.tag,
      });
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load wardrobe");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 200); // debounce filter typing
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  async function save(values: ItemFormValues) {
    if (!editing) return;
    setSaving(true);
    try {
      await updateItem(editing.id, values);
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirm(`Delete "${editing.name}"?`)) return;
    setSaving(true);
    try {
      await deleteItem(editing.id);
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar filters={filters} onChange={setFilters} />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No items yet"
          subtitle="Upload some clothing photos above to start building your wardrobe."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setEditing(item)}
              className={`group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition hover:shadow-md ${
                item.status !== "active" ? "opacity-50" : ""
              }`}
            >
              <div className="relative aspect-square bg-[#f4efe8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-2" />
                {item.status !== "active" && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium capitalize text-white">
                    {item.status}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 p-2.5">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs capitalize text-muted">{item.category}</span>
                  <ColorDots colors={item.colors} size={12} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit item">
        {editing && (
          <ItemForm
            imageUrl={editing.image_url}
            initial={{
              name: editing.name,
              category: editing.category,
              colors: editing.colors,
              tags: editing.tags,
              status: editing.status,
            }}
            submitLabel={saving ? "Saving…" : "Save changes"}
            submitting={saving}
            onSubmit={save}
            extraActions={
              <Button variant="danger" onClick={remove} disabled={saving}>
                Delete
              </Button>
            }
          />
        )}
      </Modal>
    </div>
  );
}
