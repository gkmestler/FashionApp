"use client";

import { useCallback, useEffect, useState } from "react";
import { ClothingItem } from "@/lib/types";
import type { WeekView, DayView } from "@/lib/week-data";
import { getWeek, listItems, revealDay } from "@/lib/client-api";
import { currentWeekStart, addWeeks, weekLabel } from "@/lib/week";
import RevealCard from "./RevealCard";
import { Spinner, EmptyState, Button } from "@/components/ui";

export default function MyView() {
  const [weekStart, setWeekStart] = useState<string>(currentWeekStart());
  const [view, setView] = useState<WeekView | null>(null);
  const [itemsMap, setItemsMap] = useState<Map<string, ClothingItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, items] = await Promise.all([getWeek(weekStart), listItems({})]);
      setView(v);
      setItemsMap(new Map(items.map((i) => [i.id, i])));
      // Days the Wearer already revealed start open (persisted surprise state).
      setOpenIds(new Set(v.days.filter((d) => d.revealed && d.generated_image_url).map((d) => d.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your week");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const revealable = (view?.days ?? []).filter((d) => d.generated_image_url);
  const allOpen = revealable.length > 0 && revealable.every((d) => openIds.has(d.id));

  function revealOne(day: DayView) {
    if (!day.generated_image_url) return;
    setOpenIds((prev) => new Set(prev).add(day.id));
    revealDay(day.id, true).catch(() => {});
  }

  function toggleAll() {
    if (allOpen) {
      setOpenIds(new Set()); // wrap everything back up
    } else {
      const ids = revealable.map((d) => d.id);
      setOpenIds(new Set(ids));
      // Persist reveal for any not-yet-revealed days.
      revealable
        .filter((d) => !d.revealed)
        .forEach((d) => revealDay(d.id, true).catch(() => {}));
    }
  }

  const resolveItems = (day: DayView): ClothingItem[] =>
    day.item_ids.map((id) => itemsMap.get(id)).filter((x): x is ClothingItem => !!x);

  return (
    <div className="flex flex-col gap-4">
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
        </div>

        {revealable.length > 0 && (
          <Button variant="outline" onClick={toggleAll}>
            {allOpen ? "Wrap all" : "Reveal all"}
          </Button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : revealable.length === 0 ? (
        <EmptyState
          title="No outfits yet this week"
          subtitle="Your stylist hasn't generated this week's looks yet. Check back soon! 🎁"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {view!.days.map((day) => (
            <RevealCard
              key={day.id}
              day={day}
              items={resolveItems(day)}
              open={openIds.has(day.id)}
              onReveal={() => revealOne(day)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
