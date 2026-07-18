import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { removeFromBucketByUrl, BUCKETS } from "@/lib/storage";

export const runtime = "nodejs";

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
