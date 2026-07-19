// Thin client-side fetch helpers. All privileged work is behind these routes.
import { ClothingItem, ItemDraft, GeneratedOutfit } from "./types";
import type { WeekView, DayView } from "./week-data";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ---- Items ----
export interface ItemFilters {
  q?: string;
  category?: string;
  tag?: string;
  color?: string;
  status?: string;
}

export async function listItems(filters: ItemFilters = {}): Promise<ClothingItem[]> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const res = await fetch(`/api/items?${params.toString()}`, { cache: "no-store" });
  const data = await jsonOrThrow<{ items: ClothingItem[] }>(res);
  return data.items;
}

export async function uploadFiles(files: File[]): Promise<(ItemDraft & { error?: string })[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch("/api/items/upload", { method: "POST", body: form });
  const data = await jsonOrThrow<{ drafts: (ItemDraft & { error?: string })[] }>(res);
  return data.drafts;
}

export async function createItem(draft: ItemDraft): Promise<ClothingItem> {
  const res = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const data = await jsonOrThrow<{ item: ClothingItem }>(res);
  return data.item;
}

export async function updateItem(id: string, patch: Partial<ClothingItem>): Promise<ClothingItem> {
  const res = await fetch(`/api/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await jsonOrThrow<{ item: ClothingItem }>(res);
  return data.item;
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
  await jsonOrThrow(res);
}

// ---- Mannequin ----
export async function getMannequin(): Promise<{ base_image_url: string } | null> {
  const res = await fetch("/api/mannequin", { cache: "no-store" });
  const data = await jsonOrThrow<{ mannequin: { base_image_url: string } | null }>(res);
  return data.mannequin;
}

export async function uploadMannequin(file: File): Promise<{ base_image_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/mannequin", { method: "POST", body: form });
  const data = await jsonOrThrow<{ mannequin: { base_image_url: string } }>(res);
  return data.mannequin;
}

// ---- Week ----
export async function getWeek(weekStart?: string): Promise<WeekView> {
  const params = weekStart ? `?week_start=${weekStart}` : "";
  const res = await fetch(`/api/week${params}`, { cache: "no-store" });
  return jsonOrThrow<WeekView>(res);
}

export async function updateDay(
  dayId: string,
  patch: { item_ids?: string[]; note?: string; client_note?: string },
): Promise<DayView> {
  const res = await fetch("/api/week", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day_id: dayId, ...patch }),
  });
  const data = await jsonOrThrow<{ day: DayView }>(res);
  return data.day;
}

export async function revealDay(dayId: string, revealed = true): Promise<void> {
  const res = await fetch(`/api/day/${dayId}/reveal`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revealed }),
  });
  await jsonOrThrow(res);
}

// ---- Generation ----
export interface GenResult {
  outfit_hash: string;
  image_url: string;
  palette: { hex: string; name: string }[];
  cached: boolean;
}

export async function generateOutfit(
  itemIds: string[],
  force = false,
  note?: string,
): Promise<GenResult> {
  const res = await fetch("/api/generate-outfit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_ids: itemIds, force, note }),
  });
  return jsonOrThrow<GenResult>(res);
}

// ---- Saved outfits ("looks") ----
export async function listOutfits(): Promise<GeneratedOutfit[]> {
  const res = await fetch("/api/outfits", { cache: "no-store" });
  const data = await jsonOrThrow<{ outfits: GeneratedOutfit[] }>(res);
  return data.outfits;
}

export async function deleteOutfit(id: string): Promise<void> {
  const res = await fetch(`/api/outfits/${id}`, { method: "DELETE" });
  await jsonOrThrow(res);
}

/**
 * Update a saved look: change its note, its items, and/or force a regenerate.
 * Any item change (or regenerate:true) rebuilds the image and can take a while.
 */
export async function updateOutfit(
  id: string,
  patch: { note?: string; item_ids?: string[]; regenerate?: boolean },
): Promise<GeneratedOutfit> {
  const res = await fetch(`/api/outfits/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await jsonOrThrow<{ outfit: GeneratedOutfit }>(res);
  return data.outfit;
}
