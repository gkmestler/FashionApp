import { NextRequest, NextResponse } from "next/server";
import { generateForItems } from "@/lib/generate";

export const runtime = "nodejs";
// Image generation is slow (30–60s+). Bump this on a plan that allows it.
export const maxDuration = 300;

// POST /api/generate-outfit  { item_ids: string[], force?: boolean, note?: string }
export async function POST(req: NextRequest) {
  let body: { item_ids?: string[]; force?: boolean; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.item_ids) || body.item_ids.length === 0) {
    return NextResponse.json({ error: "item_ids is required" }, { status: 400 });
  }

  try {
    const result = await generateForItems(body.item_ids, {
      force: !!body.force,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
