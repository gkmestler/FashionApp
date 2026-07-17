import { getServiceSupabase } from "./supabase/server";
import { computeOutfitHash } from "./outfit-hash";
import { uploadToBucket, fetchImageBuffer, BUCKETS } from "./storage";
import { generateOutfitImage } from "./providers/image-generation";
import { buildPalette } from "./palette";
import { ClothingItem, PaletteEntry } from "./types";

export interface GenerateResult {
  outfit_hash: string;
  image_url: string;
  palette: PaletteEntry[];
  cached: boolean;
}

/**
 * Generate (or reuse) the mannequin image for a set of item IDs.
 *
 * Caching is the whole point: unless `force` is set, an existing
 * `generated_outfits` row for this outfit_hash is returned immediately with NO
 * OpenAI call. `force` (the per-day Regenerate button) overwrites the cached
 * image for that hash.
 */
export async function generateForItems(
  itemIds: string[],
  opts: { force?: boolean } = {},
): Promise<GenerateResult> {
  const supabase = getServiceSupabase();

  const cleanIds = [...new Set(itemIds.filter((x) => typeof x === "string" && x))];
  if (cleanIds.length === 0) {
    throw new Error("No items selected for this outfit.");
  }

  const outfit_hash = computeOutfitHash(cleanIds);

  // 1. Cache check.
  if (!opts.force) {
    const { data: existing } = await supabase
      .from("generated_outfits")
      .select("outfit_hash, image_url, palette")
      .eq("outfit_hash", outfit_hash)
      .maybeSingle();
    if (existing) {
      return {
        outfit_hash,
        image_url: existing.image_url,
        palette: existing.palette ?? [],
        cached: true,
      };
    }
  }

  // 2. Active mannequin base.
  const { data: mannequin } = await supabase
    .from("mannequin_config")
    .select("base_image_url")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!mannequin?.base_image_url) {
    throw new Error("No active mannequin base image. Upload one in Stylist settings first.");
  }

  // 3. The selected clothing items (real photos + colors for the palette).
  const { data: itemsData, error: itemsError } = await supabase
    .from("clothing_items")
    .select("id, name, category, colors, image_url")
    .in("id", cleanIds);

  if (itemsError) throw new Error(itemsError.message);
  const items = (itemsData ?? []) as Pick<
    ClothingItem,
    "id" | "name" | "category" | "colors" | "image_url"
  >[];
  if (items.length === 0) {
    throw new Error("Selected items no longer exist.");
  }

  // 4. Fetch bytes for the base + item photos.
  const mannequinBuffer = await fetchImageBuffer(mannequin.base_image_url);
  const itemImages = await Promise.all(
    items.map(async (it) => ({
      buffer: await fetchImageBuffer(it.image_url),
      contentType: "image/png",
    })),
  );

  // 5. Generate.
  const generated = await generateOutfitImage({
    mannequinBase: { buffer: mannequinBuffer, contentType: "image/png" },
    itemImages,
    items: items.map((i) => ({ name: i.name, category: i.category })),
  });

  // 6. Store the image.
  const image_url = await uploadToBucket(BUCKETS.generated, generated, "image/png", "png");

  // 7. Palette from the REAL item photos' colors.
  const palette = buildPalette(items.map((i) => ({ colors: i.colors ?? [] })));

  // 8. Upsert keyed by outfit_hash (overwrites on force / regenerate).
  const { error: upsertError } = await supabase
    .from("generated_outfits")
    .upsert(
      { outfit_hash, item_ids: cleanIds, image_url, palette },
      { onConflict: "outfit_hash" },
    );
  if (upsertError) throw new Error(upsertError.message);

  return { outfit_hash, image_url, palette, cached: false };
}
