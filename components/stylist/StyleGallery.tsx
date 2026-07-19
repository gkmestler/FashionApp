"use client";

import { useCallback, useEffect, useState } from "react";
import { ClothingItem, GeneratedOutfit } from "@/lib/types";
import {
  listItems,
  listOutfits,
  deleteOutfit,
  generateOutfit,
  updateOutfit,
} from "@/lib/client-api";
import ItemPickerModal from "./ItemPickerModal";
import LookCard from "./LookCard";
import { EmptyState, Spinner, Button } from "@/components/ui";

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}

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
  // Build-a-look-from-scratch flow (no day involved).
  const [picking, setPicking] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // Per-look busy state (regenerating / editing items) + item-editing flow.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingLookId, setEditingLookId] = useState<string | null>(null);
  const [editSelectedIds, setEditSelectedIds] = useState<string[]>([]);

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

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // Save a look's note (no image change). Optimistic; no reload needed.
  async function saveNote(outfit: GeneratedOutfit, note: string) {
    setOutfits((prev) => prev.map((o) => (o.id === outfit.id ? { ...o, note } : o)));
    try {
      await updateOutfit(outfit.id, { note });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note");
      load();
    }
  }

  // Regenerate a look's image (uses its saved note). Slow — show per-card spinner.
  async function regenerate(outfit: GeneratedOutfit) {
    setBusyId(outfit.id);
    setError(null);
    try {
      await updateOutfit(outfit.id, { regenerate: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setBusyId(null);
    }
  }

  function startEditItems(outfit: GeneratedOutfit) {
    setEditingLookId(outfit.id);
    setEditSelectedIds(outfit.item_ids);
  }

  function toggleEditItem(id: string) {
    setEditSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // Close the item picker in edit mode; if the set changed, rebuild the look.
  async function finishEditItems() {
    const lookId = editingLookId;
    const original = outfits.find((o) => o.id === lookId);
    const nextIds = editSelectedIds;
    setEditingLookId(null);
    if (!lookId || !original) return;
    if (nextIds.length === 0 || sameSet(original.item_ids, nextIds)) return;

    setBusyId(lookId);
    setError(null);
    try {
      await updateOutfit(lookId, { item_ids: nextIds });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update look");
    } finally {
      setBusyId(null);
    }
  }

  async function generateLook() {
    if (selectedIds.length === 0) return;
    setGenerating(true);
    setGenError(null);
    try {
      await generateOutfit(selectedIds, false);
      setSelectedIds([]);
      await load(); // the new look shows up in the gallery
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const resolveItems = (o: GeneratedOutfit): ClothingItem[] =>
    o.item_ids.map((id) => itemsMap.get(id)).filter((x): x is ClothingItem => !!x);

  const stagedItems = selectedIds
    .map((id) => itemsMap.get(id))
    .filter((x): x is ClothingItem => !!x);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Saved looks</h2>
          <p className="text-xs text-muted">
            Every outfit you&apos;ve generated. Build a new one here, or reuse one on a day from the Week tab.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {outfits.length > 0 && <span className="text-xs text-muted">{outfits.length} saved</span>}
          <Button onClick={() => setPicking(true)} disabled={generating}>
            + Create a look
          </Button>
        </div>
      </div>

      {/* Staging bar: items chosen for a brand-new look, then Generate. */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent-soft/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              New look · {selectedIds.length} item{selectedIds.length > 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setSelectedIds([])}
              disabled={generating}
              className="text-xs text-muted hover:text-foreground disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stagedItems.map((item) => (
              <div
                key={item.id}
                className="h-11 w-11 overflow-hidden rounded-lg border border-border bg-[#1a1a17]"
                title={item.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-0.5" />
              </div>
            ))}
            <button
              onClick={() => setPicking(true)}
              disabled={generating}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent disabled:opacity-50"
              aria-label="Edit items"
            >
              +
            </button>
          </div>
          <div className="flex items-center justify-end">
            <Button onClick={generateLook} disabled={generating}>
              {generating ? (
                <>
                  <Spinner className="h-4 w-4" /> Generating…
                </>
              ) : (
                "Generate look"
              )}
            </Button>
          </div>
        </div>
      )}

      {genError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{genError}</p>}

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
          {outfits.map((outfit) => (
            <LookCard
              key={outfit.id}
              outfit={outfit}
              items={resolveItems(outfit)}
              busy={busyId === outfit.id || deletingId === outfit.id}
              onNoteSave={(note) => saveNote(outfit, note)}
              onRegenerate={() => regenerate(outfit)}
              onEditItems={() => startEditItems(outfit)}
              onDelete={() => remove(outfit)}
            />
          ))}
        </div>
      )}

      <ItemPickerModal
        open={picking || editingLookId !== null}
        onClose={editingLookId !== null ? finishEditItems : () => setPicking(false)}
        dayLabel={editingLookId !== null ? "edit look" : "new look"}
        selectedIds={editingLookId !== null ? editSelectedIds : selectedIds}
        onToggle={editingLookId !== null ? toggleEditItem : toggleSelected}
      />
    </div>
  );
}
