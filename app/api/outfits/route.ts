import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /api/outfits — every saved generated outfit ("look"), newest first.
export async function GET() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("generated_outfits")
    .select("id, outfit_hash, item_ids, image_url, palette, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outfits: data ?? [] });
}
