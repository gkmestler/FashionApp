import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /api/outfits            — active saved looks (not archived), newest first.
// GET /api/outfits?archived=1 — archived looks, most-recently-archived first.
export async function GET(req: NextRequest) {
  const supabase = getServiceSupabase();
  const archived = req.nextUrl.searchParams.get("archived") === "1";

  let query = supabase
    .from("generated_outfits")
    .select("id, outfit_hash, item_ids, image_url, palette, note, archived_at, created_at");

  query = archived
    ? query.not("archived_at", "is", null).order("archived_at", { ascending: false })
    : query.is("archived_at", null).order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outfits: data ?? [] });
}
