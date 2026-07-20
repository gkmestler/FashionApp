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
import ArchivedLookCard from "./ArchivedLookCard";
import { EmptyState, Spinner, Button } from "@/components/ui";

type GalleryView = "active" | "archived";

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
  const [view, setView] = useState<GalleryView>("active");
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
  // Unsaved item swaps, keyed by look id. A look stays on its saved items until
  // the stylist regenerates — swapping just stages a draft (see draftFor).
  const [drafts, setDrafts] = useState<Map<string, string[]>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [looks, items] = await Promise.all([
        listOutfits(view === "archived"),
        listItems({}),
      ]);
      setOutfits(looks);
      setItemsMap(new Map(items.map((i) => [i.id, i])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load saved looks");
    } finally {
      setLoading(false);
    }
  }, [view]);

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

  // Restore an archived look back to the active gallery.
  async function restore(outfit: GeneratedOutfit) {
    setBusyId(outfit.id);
    setError(null);
    setOutfits((prev) => prev.filter((o) => o.id !== outfit.id)); // leaves the archived view
    try {
      await updateOutfit(outfit.id, { archived: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
      load();
    } finally {
      setBusyId(null);
    }
  }

  // Permanently delete an archived look (image + row). No undo.
  async function deletePermanently(outfit: GeneratedOutfit) {
    if (!confirm("Permanently delete this archived look? This can't be undone.")) return;
    setDeletingId(outfit.id);
    setOutfits((prev) => prev.filter((o) => o.id !== outfit.id));
    try {
      await deleteOutfit(outfit.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      load();
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

  // The items a look currently shows: its unsaved draft if it has one, else the
  // saved set.
  const draftFor = useCallback(
    (o: GeneratedOutfit): string[] => drafts.get(o.id) ?? o.item_ids,
    [drafts],
  );

  const isDirty = (o: GeneratedOutfit): boolean => {
    const d = drafts.get(o.id);
    return !!d && !sameSet(d, o.item_ids);
  };

  function setDraft(lookId: string, next: string[]) {
    setDrafts((prev) => {
      const m = new Map(prev);
      m.set(lookId, next);
      return m;
    });
  }

  function clearDraft(lookId: string) {
    setDrafts((prev) => {
      if (!prev.has(lookId)) return prev;
      const m = new Map(prev);
      m.delete(lookId);
      return m;
    });
  }

  // Swap an item out of a look (staged; no image change until Regenerate).
  function removeDraftItem(outfit: GeneratedOutfit, itemId: string) {
    setDraft(
      outfit.id,
      draftFor(outfit).filter((x) => x !== itemId),
    );
  }

  // Toggle an item from the picker while editing a look's staged items.
  function toggleDraftItem(outfit: GeneratedOutfit, itemId: string) {
    const cur = draftFor(outfit);
    setDraft(
      outfit.id,
      cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId],
    );
  }

  // Regenerate a look's image. If its items were swapped, rebuild with the new
  // set (moves the look to a new hash); otherwise refresh the same items. Slow —
  // show a per-card spinner.
  async function regenerate(outfit: GeneratedOutfit) {
    const nextIds = draftFor(outfit);
    if (nextIds.length === 0) return;
    const changed = isDirty(outfit);
    setBusyId(outfit.id);
    setError(null);
    try {
      await updateOutfit(outfit.id, changed ? { item_ids: nextIds } : { regenerate: true });
      clearDraft(outfit.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
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
    draftFor(o).map((id) => itemsMap.get(id)).filter((x): x is ClothingItem => !!x);

  const editingLook = outfits.find((o) => o.id === editingLookId) ?? null;

  const stagedItems = selectedIds
    .map((id) => itemsMap.get(id))
    .filter((x): x is ClothingItem => !!x);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Saved looks</h2>
          <p className="text-xs text-muted">
            {view === "active"
              ? "Every outfit you've generated. Build a new one here, or reuse one on a day from the Week tab."
              : "Originals set aside when a look was re-styled. Restore one, or delete it for good."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {outfits.length > 0 && (
            <span className="text-xs text-muted">
              {outfits.length} {view === "active" ? "saved" : "archived"}
            </span>
          )}
          {view === "active" && (
            <Button onClick={() => setPicking(true)} disabled={generating}>
              + Create a look
            </Button>
          )}
        </div>
      </div>

      {/* Active / Archived toggle */}
      <div className="inline-flex self-start rounded-lg border border-border p-0.5 text-xs">
        {(["active", "archived"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1 font-medium capitalize transition ${
              view === v ? "bg-accent text-black" : "text-muted hover:text-foreground"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Staging bar: items chosen for a brand-new look, then Generate. */}
      {view === "active" && selectedIds.length > 0 && (
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
        view === "active" ? (
          <EmptyState
            title="No saved looks yet"
            subtitle="Generate outfits in the Week tab and they'll be saved here as reusable styles."
          />
        ) : (
          <EmptyState
            title="Nothing archived"
            subtitle="Swapping a look's items and regenerating moves the original here."
          />
        )
      ) : view === "active" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {outfits.map((outfit) => (
            <LookCard
              key={outfit.id}
              outfit={outfit}
              items={resolveItems(outfit)}
              dirty={isDirty(outfit)}
              busy={busyId === outfit.id || deletingId === outfit.id}
              onNoteSave={(note) => saveNote(outfit, note)}
              onRegenerate={() => regenerate(outfit)}
              onOpenPicker={() => setEditingLookId(outfit.id)}
              onRemoveItem={(id) => removeDraftItem(outfit, id)}
              onRevertItems={() => clearDraft(outfit.id)}
              onDelete={() => remove(outfit)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {outfits.map((outfit) => (
            <ArchivedLookCard
              key={outfit.id}
              outfit={outfit}
              items={resolveItems(outfit)}
              busy={busyId === outfit.id || deletingId === outfit.id}
              onRestore={() => restore(outfit)}
              onDelete={() => deletePermanently(outfit)}
            />
          ))}
        </div>
      )}

      <ItemPickerModal
        open={picking || editingLook !== null}
        onClose={editingLook !== null ? () => setEditingLookId(null) : () => setPicking(false)}
        dayLabel={editingLook !== null ? "edit look" : "new look"}
        selectedIds={editingLook !== null ? draftFor(editingLook) : selectedIds}
        onToggle={editingLook !== null ? (id) => toggleDraftItem(editingLook, id) : toggleSelected}
      />
    </div>
  );
}
