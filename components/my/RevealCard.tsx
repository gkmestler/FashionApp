"use client";

import { ClothingItem, DAY_NAMES, DAY_SHORT } from "@/lib/types";
import type { DayView } from "@/lib/week-data";
import { PaletteStrip, ZoomableImage } from "@/components/ui";

/**
 * A single day in My view. Starts "wrapped"; tapping reveals the mannequin
 * image, the items, the palette, and the Stylist's note with an animation.
 */
export default function RevealCard({
  day,
  items,
  open,
  onReveal,
}: {
  day: DayView;
  items: ClothingItem[];
  open: boolean;
  onReveal: () => void;
}) {
  const hasOutfit = !!day.generated_image_url;

  if (!open) {
    return (
      <button
        onClick={onReveal}
        disabled={!hasOutfit}
        className={`group relative flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-3xl border text-center transition ${
          hasOutfit
            ? "cursor-pointer border-accent/40 bg-gradient-to-br from-accent-soft to-background hover:border-accent hover:shadow-lg active:scale-[0.98]"
            : "cursor-default border-border bg-surface"
        }`}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          {DAY_SHORT[day.day_of_week]}
        </span>
        {hasOutfit ? (
          <>
            <span className="mt-2 text-4xl transition group-hover:scale-110">🎁</span>
            <span className="mt-3 text-sm font-medium text-foreground/80">Tap to reveal</span>
          </>
        ) : (
          <span className="mt-3 px-4 text-xs text-muted">Nothing planned yet</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-sm font-semibold">{DAY_NAMES[day.day_of_week]}</span>
        {day.palette?.length > 0 && <PaletteStrip palette={day.palette} size={16} />}
      </div>

      <div className="animate-flip-in mt-2 aspect-[2/3] bg-[#1a1a17]">
        <ZoomableImage src={day.generated_image_url!} alt="Today's outfit" className="h-full w-full object-contain" />
      </div>

      <div className="animate-fade-up flex flex-col gap-2.5 p-4">
        {day.note && (
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm italic text-foreground/80">
            “{day.note}”
          </p>
        )}
        {items.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-8 w-8 rounded-md border border-border bg-[#1a1a17] object-contain p-0.5"
                />
                <span className="flex-1 truncate">{item.name}</span>
                <span className="text-xs capitalize text-muted">{item.category}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
