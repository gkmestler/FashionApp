"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClothingItem } from "@/lib/types";
import type { WeekView, DayView } from "@/lib/week-data";
import { getWeek, listItems, updateDay, generateOutfit } from "@/lib/client-api";
import { currentWeekStart, addWeeks, weekLabel } from "@/lib/week";
import DayCard, { DayGenState } from "./DayCard";
import ItemPickerModal from "./ItemPickerModal";
import { Button, Spinner, EmptyState } from "@/components/ui";
import { DAY_NAMES } from "@/lib/types";

export default function WeekBuilder({ refreshKey }: { refreshKey: number }) {
  const [weekStart, setWeekStart] = useState<string>(currentWeekStart());
  const [view, setView] = useState<WeekView | null>(null);
  const [itemsMap, setItemsMap] = useState<Map<string, ClothingItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [genStates, setGenStates] = useState<Record<string, DayGenState>>({});
  const [genErrors, setGenErrors] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);

  const loadItems = useCallback(async () => {
    const all = await listItems({});
    setItemsMap(new Map(all.map((i) => [i.id, i])));
  }, []);

  const loadWeek = useCallback(async () => {
    setError(null);
    try {
      const v = await getWeek(weekStart);
      setView(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load week");
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
    setView((prev) =>
      prev ? { ...prev, days: prev.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)) } : prev,
    );
  }

  async function toggleItem(dayId: string, itemId: string) {
    const day = view?.days.find((d) => d.id === dayId);
    if (!day) return;
    const next = day.item_ids.includes(itemId)
      ? day.item_ids.filter((x) => x !== itemId)
      : [...day.item_ids, itemId];
    patchDayLocal(dayId, { item_ids: next }); // optimistic
    try {
      await updateDay(dayId, { item_ids: next });
      await loadWeek(); // refresh outfit_hash + any cached generated image
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update day");
      loadWeek();
    }
  }

  async function saveNote(dayId: string, note: string) {
    patchDayLocal(dayId, { note });
    try {
      await updateDay(dayId, { note });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note");
    }
  }

  async function generateDay(dayId: string, force: boolean): Promise<boolean> {
    const day = view?.days.find((d) => d.id === dayId);
    if (!day || day.item_ids.length === 0) return false;
    setGenStates((s) => ({ ...s, [dayId]: "generating" }));
    setGenErrors((e) => ({ ...e, [dayId]: "" }));
    try {
      const res = await generateOutfit(day.item_ids, force);
      patchDayLocal(dayId, { generated_image_url: res.image_url, palette: res.palette, outfit_hash: res.outfit_hash });
      setGenStates((s) => ({ ...s, [dayId]: "idle" }));
      return true;
    } catch (e) {
      setGenStates((s) => ({ ...s, [dayId]: "error" }));
      setGenErrors((er) => ({ ...er, [dayId]: e instanceof Error ? e.message : "Generation failed" }));
      return false;
    }
  }

  async function generateWeek() {
    if (!view) return;
    // Uncached days = have items but no generated image yet.
    const targets = view.days.filter((d) => d.item_ids.length > 0 && !d.generated_image_url);
    if (targets.length === 0) return;
    setBatch({ done: 0, total: targets.length });
    // Fan out in parallel; update progress as each settles.
    await Promise.all(
      targets.map((d) =>
        generateDay(d.id, false).finally(() =>
          setBatch((b) => (b ? { ...b, done: b.done + 1 } : b)),
        ),
      ),
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

  return (
    <div className="flex flex-col gap-4">
      {/* Week nav + generate */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
            className="rounded-full border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-accent-soft"
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
            className="rounded-full border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-accent-soft"
            aria-label="Next week"
          >
            ›
          </button>
          {weekStart !== currentWeekStart() && (
            <button
              onClick={() => setWeekStart(currentWeekStart())}
              className="ml-1 rounded-full px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            {stats.generated}/{stats.withItems} generated
          </span>
          <Button onClick={generateWeek} disabled={!!batch || stats.uncached === 0}>
            {batch ? (
              <>
                <Spinner className="h-4 w-4" /> {batch.done}/{batch.total}
              </>
            ) : (
              `Generate week${stats.uncached > 0 ? ` (${stats.uncached})` : ""}`
            )}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {batch && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-accent-soft">
          <div
            className="h-full rounded-full bg-accent transition-all"
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
              genState={genStates[day.id] ?? "idle"}
              genError={genErrors[day.id]}
              onOpenPicker={() => setPickerDayId(day.id)}
              onRemoveItem={(id) => toggleItem(day.id, id)}
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
    </div>
  );
}
