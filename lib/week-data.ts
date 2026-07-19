import { getServiceSupabase } from "./supabase/server";
import { computeOutfitHash } from "./outfit-hash";
import { DayOutfit, PaletteEntry } from "./types";

export interface DayView extends DayOutfit {
  generated_image_url: string | null;
  palette: PaletteEntry[];
}

export interface WeekView {
  week: { id: string; week_start: string };
  days: DayView[];
}

/** Find the week plan for a Monday date, creating it (and its 7 days) if absent. */
export async function ensureWeek(weekStart: string): Promise<{ id: string; week_start: string }> {
  const supabase = getServiceSupabase();

  const existing = await supabase
    .from("week_plans")
    .select("id, week_start")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing.data) return existing.data;

  const inserted = await supabase
    .from("week_plans")
    .insert({ week_start: weekStart })
    .select("id, week_start")
    .single();

  // Handle the race where another request created it first.
  if (inserted.error) {
    const retry = await supabase
      .from("week_plans")
      .select("id, week_start")
      .eq("week_start", weekStart)
      .single();
    if (retry.error) throw new Error(inserted.error.message);
    return retry.data;
  }

  // Seed the 7 empty day rows.
  const rows = Array.from({ length: 7 }, (_, day_of_week) => ({
    week_plan_id: inserted.data.id,
    day_of_week,
    item_ids: [] as string[],
  }));
  await supabase.from("day_outfits").insert(rows);

  return inserted.data;
}

/** Load a full week view: 7 days with their cached generated image + palette. */
export async function loadWeekView(weekStart: string): Promise<WeekView> {
  const supabase = getServiceSupabase();
  const week = await ensureWeek(weekStart);

  const { data: dayRows, error } = await supabase
    .from("day_outfits")
    .select("*")
    .eq("week_plan_id", week.id)
    .order("day_of_week", { ascending: true });

  if (error) throw new Error(error.message);

  const days = (dayRows ?? []) as DayOutfit[];

  // Collect the hashes we need generated images for.
  const hashes = days.map((d) => d.outfit_hash).filter((h): h is string => !!h);
  const genByHash = new Map<string, { image_url: string; palette: PaletteEntry[] }>();

  if (hashes.length > 0) {
    const { data: gens } = await supabase
      .from("generated_outfits")
      .select("outfit_hash, image_url, palette")
      .in("outfit_hash", hashes);
    for (const g of gens ?? []) {
      genByHash.set(g.outfit_hash, { image_url: g.image_url, palette: g.palette ?? [] });
    }
  }

  const dayViews: DayView[] = days.map((d) => {
    const gen = d.outfit_hash ? genByHash.get(d.outfit_hash) : undefined;
    return {
      ...d,
      generated_image_url: gen?.image_url ?? null,
      palette: gen?.palette ?? [],
    };
  });

  return { week, days: dayViews };
}

/** Update a single day's item set and/or notes. Recomputes the hash. */
export async function updateDay(
  dayId: string,
  patch: { item_ids?: string[]; note?: string; client_note?: string },
): Promise<DayOutfit> {
  const supabase = getServiceSupabase();
  const update: Record<string, unknown> = {};

  if (Array.isArray(patch.item_ids)) {
    const ids = patch.item_ids.filter((x) => typeof x === "string");
    update.item_ids = ids;
    update.outfit_hash = ids.length > 0 ? computeOutfitHash(ids) : null;
  }
  if (typeof patch.note === "string") {
    update.note = patch.note;
  }
  // The Wearer's note is display-only for the Stylist — deliberately kept out of
  // the outfit hash and out of anything handed to the generation prompt.
  if (typeof patch.client_note === "string") {
    update.client_note = patch.client_note;
  }

  const { data, error } = await supabase
    .from("day_outfits")
    .update(update)
    .eq("id", dayId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DayOutfit;
}
