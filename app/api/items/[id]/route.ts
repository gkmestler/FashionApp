import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { CATEGORIES, STATUSES } from "@/lib/types";

export const runtime = "nodejs";

// PATCH /api/items/:id — edit item fields
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getServiceSupabase();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.trim() || "New Item";
  if (typeof body.category === "string" && (CATEGORIES as readonly string[]).includes(body.category)) {
    update.category = body.category;
  }
  if (typeof body.status === "string" && (STATUSES as readonly string[]).includes(body.status)) {
    update.status = body.status;
  }
  if (Array.isArray(body.colors)) {
    update.colors = body.colors.filter((c) => typeof c === "string").map((c) => (c as string).trim()).filter(Boolean);
  }
  if (Array.isArray(body.tags)) {
    update.tags = body.tags.filter((t) => typeof t === "string").map((t) => (t as string).trim()).filter(Boolean);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clothing_items")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// DELETE /api/items/:id
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("clothing_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
