import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { CATEGORIES, STATUSES, Category, ItemStatus } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/items?q=&category=&tag=&color=&status=
export async function GET(req: NextRequest) {
  const supabase = getServiceSupabase();
  const { searchParams } = new URL(req.url);

  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const tag = searchParams.get("tag")?.trim();
  const color = searchParams.get("color")?.trim();
  const status = searchParams.get("status")?.trim();

  let query = supabase.from("clothing_items").select("*").order("created_at", { ascending: false });

  if (q) query = query.ilike("name", `%${q}%`);
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    query = query.eq("category", category);
  }
  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }
  if (tag) query = query.contains("tags", [tag]);
  if (color) query = query.contains("colors", [color]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// POST /api/items  — create item on Stylist confirm
export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const image_url = typeof body.image_url === "string" ? body.image_url : "";
  if (!image_url) {
    return NextResponse.json({ error: "image_url is required" }, { status: 400 });
  }

  const record = {
    name: str(body.name, "New Item"),
    category: normCategory(body.category),
    colors: strArray(body.colors),
    tags: strArray(body.tags),
    image_url,
    original_image_url: typeof body.original_image_url === "string" ? body.original_image_url : null,
    status: normStatus(body.status),
  };

  const { data, error } = await supabase.from("clothing_items").insert(record).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string").map((x) => (x as string).trim()).filter(Boolean);
}
function normCategory(v: unknown): Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v)
    ? (v as Category)
    : "other";
}
function normStatus(v: unknown): ItemStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v)
    ? (v as ItemStatus)
    : "active";
}
