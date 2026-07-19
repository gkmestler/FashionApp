import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { removeFromBucketByUrl, BUCKETS } from "@/lib/storage";
import { computeOutfitHash } from "@/lib/outfit-hash";
import { generateForItems } from "@/lib/generate";

export const runtime = "nodejs";
// Editing items or forcing a regenerate runs image generation (slow).
export const maxDuration = 300;

const OUTFIT_COLS = "id, outfit_hash, item_ids, image_url, palette, note, created_at";

// PATCH /api/outfits/:id  { note?, item_ids?, regenerate? }
// - note only            → save the look's note (no image change)
// - item_ids changed     → rebuild the look with the new items (regenerates)
// - regenerate: true     → force a fresh image for the same items
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getServiceSupabase();

  let body: { note?: string; item_ids?: string[]; regenerate?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("generated_outfits")
    .select(OUTFIT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Outfit not found" }, { status: 404 });

  const finalNote =
    body.note !== undefined ? (body.note.trim() || null) : (existing.note as string | null);

  const finalItems = Array.isArray(body.item_ids)
    ? [...new Set(body.item_ids.filter((x) => typeof x === "string" && x))]
    : (existing.item_ids as string[]);

  const newHash = finalItems.length > 0 ? computeOutfitHash(finalItems) : existing.outfit_hash;
  const itemsChanged = newHash !== existing.outfit_hash;
  const shouldRegen = !!body.regenerate || itemsChanged;

  // --- Note-only update: no image work. ---
  if (!shouldRegen) {
    const { data, error } = await supabase
      .from("generated_outfits")
      .update({ note: finalNote })
      .eq("id", id)
      .select(OUTFIT_COLS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ outfit: data });
  }

  // --- Regenerate (items changed and/or explicit regenerate). ---
  if (finalItems.length === 0) {
    return NextResponse.json({ error: "A look needs at least one item." }, { status: 400 });
  }

  try {
    // Upserts (or overwrites) the generated_outfits row for newHash with a fresh
    // image + palette, applying the note to the prompt.
    await generateForItems(finalItems, { force: true, note: finalNote ?? undefined });

    // Persist the note on the resulting row.
    await supabase
      .from("generated_outfits")
      .update({ note: finalNote })
      .eq("outfit_hash", newHash);

    // If the item set changed, the look "moved" to a new hash — remove the old
    // row + image so we don't leave a stale duplicate behind.
    if (itemsChanged) {
      const { data: newRow } = await supabase
        .from("generated_outfits")
        .select("id")
        .eq("outfit_hash", newHash)
        .maybeSingle();
      if (newRow && newRow.id !== id) {
        await supabase.from("generated_outfits").delete().eq("id", id);
        await removeFromBucketByUrl(BUCKETS.generated, existing.image_url as string);
      }
    }

    const { data: result, error: resultError } = await supabase
      .from("generated_outfits")
      .select(OUTFIT_COLS)
      .eq("outfit_hash", newHash)
      .single();
    if (resultError) return NextResponse.json({ error: resultError.message }, { status: 500 });
    return NextResponse.json({ outfit: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Regeneration failed" },
      { status: 500 },
    );
  }
}

// DELETE /api/outfits/:id — remove a saved generated outfit and its image.
//
// day_outfits reference the outfit by `outfit_hash` (a plain column, not a FK),
// so any day using this look simply loses its cached image and can regenerate.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getServiceSupabase();

  const { data: existing, error: fetchError } = await supabase
    .from("generated_outfits")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Outfit not found" }, { status: 404 });

  const { error } = await supabase.from("generated_outfits").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: drop the underlying image file too.
  await removeFromBucketByUrl(BUCKETS.generated, existing.image_url);

  return NextResponse.json({ ok: true });
}
