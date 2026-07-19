"use client";

import { useEffect, useRef, useState } from "react";
import { DAY_SHORT } from "@/lib/types";
import type { DayView } from "@/lib/week-data";

/**
 * The Wearer's notes for the week — one box per day, always visible (even before
 * the Stylist has generated anything, so a week can be annotated ahead of time).
 * Writes `client_note`, which the Stylist sees on her day cards.
 */
export default function WeekNotes({
  days,
  onNoteChange,
}: {
  days: DayView[];
  onNoteChange: (dayId: string, note: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-3.5">
      <div className="mb-2.5">
        <h2 className="text-sm font-semibold">Notes for your stylist</h2>
        <p className="text-[11px] text-muted">
          Anything happening this week? She&apos;ll plan around it.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => (
          <NoteBox key={day.id} day={day} onNoteChange={onNoteChange} />
        ))}
      </div>
    </section>
  );
}

function NoteBox({
  day,
  onNoteChange,
}: {
  day: DayView;
  onNoteChange: (dayId: string, note: string) => void;
}) {
  const [note, setNote] = useState(day.client_note ?? "");
  const firstRender = useRef(true);

  // Keep local text in sync when the week reloads.
  useEffect(() => {
    setNote(day.client_note ?? "");
  }, [day.id, day.client_note]);

  // Debounced save — matches the Stylist's note field in stylist/DayCard.tsx.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (note !== (day.client_note ?? "")) onNoteChange(day.id, note);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted">{DAY_SHORT[day.day_of_week]}</span>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="—"
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
      />
    </label>
  );
}
