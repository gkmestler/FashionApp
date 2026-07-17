import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// PATCH /api/day/:id/reveal  { revealed?: boolean }  (defaults to true)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getServiceSupabase();

  let revealed = true;
  try {
    const body = await req.json();
    if (typeof body?.revealed === "boolean") revealed = body.revealed;
  } catch {
    /* default true */
  }

  const { data, error } = await supabase
    .from("day_outfits")
    .update({ revealed })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ day: data });
}
