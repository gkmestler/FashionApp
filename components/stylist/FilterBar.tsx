"use client";

import { CATEGORIES } from "@/lib/types";

export interface Filters {
  q: string;
  category: string;
  status: string;
  tag: string;
}

export const EMPTY_FILTERS: Filters = { q: "", category: "", status: "", tag: "" };

/** Shared search/filter row for the wardrobe and the outfit item picker. */
export default function FilterBar({
  filters,
  onChange,
  showStatus = true,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  showStatus?: boolean;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[160px] flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search by name…"
          className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>

      <select
        value={filters.category}
        onChange={(e) => set({ category: e.target.value })}
        className="rounded-full border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {showStatus && (
        <select
          value={filters.status}
          onChange={(e) => set({ status: e.target.value })}
          className="rounded-full border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="washing">Washing</option>
          <option value="retired">Retired</option>
        </select>
      )}

      <input
        value={filters.tag}
        onChange={(e) => set({ tag: e.target.value })}
        placeholder="tag"
        className="w-24 rounded-full border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {(filters.q || filters.category || filters.status || filters.tag) && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="rounded-full px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
