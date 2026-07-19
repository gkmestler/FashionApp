"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClothingItem, GeneratedOutfit } from "@/lib/types";
import type { WeekView, DayView } from "@/lib/week-data";
import { getWeek, listItems, updateDay } from "@/lib/client-api";
import { currentWeekStart, addWeeks, weekLabel } from "@/lib/week";
import {
  useGenerationEntries,
  startGeneration,
  consumeGeneration,
} from "@/lib/generation-store";
import DayCard, { DayGenState } from "./DayCard";
import ItemPickerModal from "./ItemPickerModal";
import StylePickerModal from "./StylePickerModal";
import { Button, Spinner, EmptyState } from "@/components/ui";
import { DAY_NAMES } from "@/lib/types";

export default function WeekBuilder({ refreshKey }: { refreshKey: number }) {
  const [weekStart, setWeekStart] = useState<string>(currentWeekStart());
  const [view, setView] = useState<WeekView | null>(null);
  const [itemsMap, setItemsMap] = useState<Map<string, ClothingItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [lookPickerDayId, setLookPickerDayId] = useState<string | null>(null);
  // Generation status lives in a module-level store so it survives tab switches
  // (this component unmounts when the Stylist changes tabs).
  const genEntries = useGenerationEntries();
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);

  // Day edits are serialized (writeChain) and reloads are sequence-guarded
  // (loadSeq) so rapid edits can't leave a day desynced from the DB — which is
  // what orphaned generated looks from their day. viewRef mirrors `view`
  // synchronously so a queued mutation always builds on the latest item set.
  const viewRef = useRef<WeekView | null>(null);
  const loadSeq = useRef(0);
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());

  // Run day writes one at a time so concurrent updateDay calls can't interleave
  // and drop each other's items.
  const enqueueWrite = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = writeChain.current.then(fn, fn);
    writeChain.current = run.then(
      () => {},
      () => {},
    );
    return run as Promise<T>;
  }, []);

  const loadItems = useCallback(async () => {
    const all = await listItems({});
    setItemsMap(new Map(all.map((i) => [i.id, i])));
  }, []);

  const loadWeek = useCallback(async () => {
    const seq = ++loadSeq.current;
    setError(null);
    try {
      const v = await getWeek(weekStart);
      // Ignore stale / out-of-order responses so a late reload can't clobber a
      // freshly edited or generated day (which made the image blink away).
      if (seq !== loadSeq.current) return;
      viewRef.current = v;
      setView(v);
    } catch (e) {
      if (seq === loadSeq.current) setError(e instanceof Error ? e.message : "Failed to load week");
    }
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadWeek(), loadItems()]).finally(() => setLoading(false));
  }, [loadWeek, loadItems, refreshKey]);

  const resolveItems = useCallback(
    (day: DayView): ClothingItem[] =>
      day.item_ids.map((id) => itemsMap.get(id)).filter((x): x is ClothingItem => !!x),
    [itemsMap],
  );

  function patchDayLocal(dayId: string, patch: Partial<DayView>) {
    setView((prev) => {
      const nextView = prev
        ? { ...prev, days: prev.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)) }
        : prev;
      viewRef.current = nextView; // keep the ref in lockstep for queued writes
      return nextView;
    });
  }

  // Apply any generations that finished (possibly while this component was
  // unmounted on another tab) into the loaded week, then clear them from the
  // store. Errors are left in the store so their day keeps showing Retry.
  useEffect(() => {
    if (!view) return;
    for (const [dayId, entry] of Object.entries(genEntries)) {
      if (entry.status !== "done") continue;
      const inView = view.days.some((d) => d.id === dayId);
      if (inView && entry.result) {
        patchDayLocal(dayId, {
          generated_image_url: entry.result.image_url,
          palette: entry.result.palette,
          outfit_hash: entry.result.outfit_hash,
        });
      }
      consumeGeneration(dayId); // applied, or belongs to a different week
    }
  }, [genEntries, view]);

  function toggleItem(dayId: string, itemId: string) {
    const day = viewRef.current?.days.find((d) => d.id === dayId);
    if (!day) return;
    const next = day.item_ids.includes(itemId)
      ? day.item_ids.filter((x) => x !== itemId)
      : [...day.item_ids, itemId];
    patchDayLocal(dayId, { item_ids: next }); // optimistic, from the latest state
    enqueueWrite(() => updateDay(dayId, { item_ids: next }))
      .then(() => loadWeek()) // refresh outfit_hash + any cached generated image
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to update day");
        loadWeek();
      });
  }

  function clearDay(dayId: string) {
    // Empty the day (item_ids -> []). The server nulls the outfit_hash; the
    // generated_outfits row is never deleted, so the look is still reusable.
    patchDayLocal(dayId, {
      item_ids: [],
      outfit_hash: null,
      generated_image_url: null,
      palette: [],
    });
    enqueueWrite(() => updateDay(dayId, { item_ids: [] }))
      .then(() => loadWeek())
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to clear day");
        loadWeek();
      });
  }

  function applyLook(dayId: string, outfit: GeneratedOutfit) {
    // Reuse a saved look: set the day to the outfit's items. The hash is
    // deterministic, so the cached image links immediately — patch it straight
    // from the outfit so it shows without waiting on (or racing) a reload.
    patchDayLocal(dayId, {
      item_ids: outfit.item_ids,
      outfit_hash: outfit.outfit_hash,
      generated_image_url: outfit.image_url,
      palette: outfit.palette,
    });
    enqueueWrite(() => updateDay(dayId, { item_ids: outfit.item_ids }))
      .then(() => loadWeek())
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to apply look");
        loadWeek();
      });
  }

  function saveNote(dayId: string, note: string) {
    patchDayLocal(dayId, { note });
    enqueueWrite(() => updateDay(dayId, { note })).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to save note"),
    );
  }

  async function generateDay(dayId: string, force: boolean): Promise<unknown> {
    const day = viewRef.current?.days.find((d) => d.id === dayId);
    if (!day || day.item_ids.length === 0) return;
    // Persist the day's items FIRST so its outfit_hash matches the look we're
    // about to generate. Without this, the image saves to generated_outfits but
    // the day never links to it — it shows once, then vanishes on reload and is
    // invisible to the wearer.
    try {
      await enqueueWrite(() => updateDay(dayId, { item_ids: day.item_ids }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save the day");
      return;
    }
    // Fire-and-forget into the store; it owns the promise so the generation
    // continues (and stays visible) even if this component unmounts. The note is
    // passed so styling instructions (e.g. "tuck in the shirt") affect the render.
    return startGeneration(dayId, day.item_ids, force, day.note ?? undefined);
  }

  async function generateWeek() {
    const cur = viewRef.current;
    if (!cur) return;
    // Uncached days = have items, no generated image, not already generating.
    const targets = cur.days.filter(
      (d) =>
        d.item_ids.length > 0 &&
        !d.generated_image_url &&
        genEntries[d.id]?.status !== "generating",
    );
    if (targets.length === 0) return;
    setBatch({ done: 0, total: targets.length });
    // Fan out; persist each day's items before generating so every one durably
    // links to its look.
    await Promise.all(
      targets.map(async (d) => {
        try {
          await enqueueWrite(() => updateDay(d.id, { item_ids: d.item_ids }));
          await startGeneration(d.id, d.item_ids, false, d.note ?? undefined);
        } catch {
          /* the day keeps its error state via the store */
        } finally {
          setBatch((b) => (b ? { ...b, done: b.done + 1 } : b));
        }
      }),
    );
    setBatch(null);
  }

  const stats = useMemo(() => {
    if (!view) return { withItems: 0, generated: 0, uncached: 0 };
    const withItems = view.days.filter((d) => d.item_ids.length > 0);
    const generated = withItems.filter((d) => d.generated_image_url);
    return {
      withItems: withItems.length,
      generated: generated.length,
      uncached: withItems.length - generated.length,
    };
  }, [view]);

  const pickerDay = view?.days.find((d) => d.id === pickerDayId) ?? null;
  const lookPickerDay = view?.days.find((d) => d.id === lookPickerDayId) ?? null;
  const anyGenerating = Object.values(genEntries).some((e) => e.status === "generating");

  const dayGenState = (dayId: string): DayGenState => {
    const s = genEntries[dayId]?.status;
    if (s === "generating") return "generating";
    if (s === "error") return "error";
    return "idle";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Week nav + generate */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
            className="rounded-none border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-accent-soft"
            aria-label="Previous week"
          >
            ‹
          </button>
          <div className="px-2 text-center">
            <div className="text-sm font-semibold">{weekLabel(weekStart)}</div>
            {weekStart === currentWeekStart() && <div className="text-[11px] text-accent">This week</div>}
          </div>
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="rounded-none border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-accent-soft"
            aria-label="Next week"
          >
            ›
          </button>
          {weekStart !== currentWeekStart() && (
            <button
              onClick={() => setWeekStart(currentWeekStart())}
              className="ml-1 rounded-none px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            {stats.generated}/{stats.withItems} generated
          </span>
          <Button onClick={generateWeek} disabled={!!batch || anyGenerating || stats.uncached === 0}>
            {batch ? (
              <>
                <Spinner className="h-4 w-4" /> {batch.done}/{batch.total}
              </>
            ) : anyGenerating ? (
              <>
                <Spinner className="h-4 w-4" /> Generating…
              </>
            ) : (
              `Generate week${stats.uncached > 0 ? ` (${stats.uncached})` : ""}`
            )}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {batch && (
        <div className="h-2 w-full overflow-hidden rounded-none bg-accent-soft">
          <div
            className="h-full rounded-none bg-accent transition-all"
            style={{ width: `${batch.total ? (batch.done / batch.total) * 100 : 0}%` }}
          />
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : !view ? (
        <EmptyState title="Couldn't load the week" subtitle="Check your Supabase configuration." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {view.days.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              items={resolveItems(day)}
              genState={dayGenState(day.id)}
              genError={genEntries[day.id]?.error}
              onOpenPicker={() => setPickerDayId(day.id)}
              onOpenLookPicker={() => setLookPickerDayId(day.id)}
              onRemoveItem={(id) => toggleItem(day.id, id)}
              onClear={() => clearDay(day.id)}
              onNoteChange={(note) => saveNote(day.id, note)}
              onRegenerate={() => generateDay(day.id, true)}
            />
          ))}
        </div>
      )}

      <ItemPickerModal
        open={!!pickerDay}
        onClose={() => {
          setPickerDayId(null);
        }}
        dayLabel={pickerDay ? DAY_NAMES[pickerDay.day_of_week] : ""}
        selectedIds={pickerDay?.item_ids ?? []}
        onToggle={(id) => pickerDay && toggleItem(pickerDay.id, id)}
      />

      <StylePickerModal
        open={!!lookPickerDay}
        onClose={() => setLookPickerDayId(null)}
        dayLabel={lookPickerDay ? DAY_NAMES[lookPickerDay.day_of_week] : ""}
        currentHash={lookPickerDay?.outfit_hash ?? null}
        onPick={(outfit) => lookPickerDay && applyLook(lookPickerDay.id, outfit)}
      />
    </div>
  );
}
