"use client";

import { useSyncExternalStore } from "react";
import { generateOutfit, GenResult } from "./client-api";

/**
 * Module-level generation store.
 *
 * Image generation must survive the Stylist switching tabs (which unmounts
 * WeekBuilder). If the in-flight promise and its status lived in component
 * state, unmounting would orphan the result — the network call still finishes
 * and the DB row is written, but the UI loses track of it.
 *
 * So ownership lives here, outside React. Components subscribe via
 * `useGenerationEntries()`. A generation keeps running regardless of what's
 * mounted; when a WeekBuilder mounts (or re-mounts) it re-attaches to whatever
 * is still generating and applies any results that finished while it was away.
 */

export type GenStatus = "generating" | "done" | "error";

export interface GenEntry {
  status: GenStatus;
  error?: string;
  result?: GenResult;
  promise?: Promise<GenResult | null>;
}

// Keyed by day id.
let entries: Record<string, GenEntry> = {};
const listeners = new Set<() => void>();

function emit(next: Record<string, GenEntry>) {
  entries = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Record<string, GenEntry> {
  return entries;
}

/** React hook: the current map of in-flight / finished generations. */
export function useGenerationEntries(): Record<string, GenEntry> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Start (or re-use) a generation for a day. Dedupes: if one is already running
 * for this day, its existing promise is returned rather than firing a second
 * call. The returned promise resolves to the result, or null on failure.
 */
export function startGeneration(
  dayId: string,
  itemIds: string[],
  force: boolean,
  note?: string,
): Promise<GenResult | null> {
  const existing = entries[dayId];
  if (existing?.status === "generating" && existing.promise) {
    return existing.promise;
  }

  const promise = generateOutfit(itemIds, force, note)
    .then((result) => {
      emit({ ...entries, [dayId]: { status: "done", result, promise } });
      return result;
    })
    .catch((err: unknown) => {
      emit({
        ...entries,
        [dayId]: {
          status: "error",
          error: err instanceof Error ? err.message : "Generation failed",
          promise,
        },
      });
      return null;
    });

  emit({ ...entries, [dayId]: { status: "generating", promise } });
  return promise;
}

/** Remove a finished (done/error) entry once a component has applied it. */
export function consumeGeneration(dayId: string) {
  if (!entries[dayId]) return;
  const next = { ...entries };
  delete next[dayId];
  emit(next);
}
