import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { uploadToBucket, BUCKETS } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/mannequin — return the active mannequin base (or null)
export async function GET() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("mannequin_config")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mannequin: data ?? null });
}

// POST /api/mannequin  (multipart/form-data, field "file")
// Uploads a new base image and marks it the active mannequin (others deactivated).
export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const type = file.type || "image/png";
  const ext = type.includes("jpeg") || type.includes("jpg") ? "jpg" : "png";

  const base_image_url = await uploadToBucket(BUCKETS.mannequin, buffer, type, ext);

  // Deactivate previous bases, then insert the new active one (keeps history).
  await supabase.from("mannequin_config").update({ is_active: false }).eq("is_active", true);

  const { data, error } = await supabase
    .from("mannequin_config")
    .insert({ base_image_url, is_active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mannequin: data }, { status: 201 });
}
