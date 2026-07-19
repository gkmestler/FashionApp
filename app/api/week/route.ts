import { NextRequest, NextResponse } from "next/server";
import { loadWeekView, updateDay } from "@/lib/week-data";
import { currentWeekStart } from "@/lib/week";

export const runtime = "nodejs";

function isWeekStart(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// GET /api/week?week_start=YYYY-MM-DD (defaults to current week)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const param = searchParams.get("week_start");
  const weekStart = isWeekStart(param) ? param : currentWeekStart();
  try {
    const view = await loadWeekView(weekStart);
    return NextResponse.json(view);
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

// POST /api/week  { week_start } — ensure a week exists and return it
export async function POST(req: NextRequest) {
  let body: { week_start?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine — defaults to current week */
  }
  const weekStart = isWeekStart(body.week_start ?? null) ? body.week_start! : currentWeekStart();
  try {
    const view = await loadWeekView(weekStart);
    return NextResponse.json(view);
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

// PATCH /api/week  { day_id, item_ids?, note?, client_note? } — update one day
export async function PATCH(req: NextRequest) {
  let body: { day_id?: string; item_ids?: string[]; note?: string; client_note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.day_id) {
    return NextResponse.json({ error: "day_id is required" }, { status: 400 });
  }
  try {
    const day = await updateDay(body.day_id, {
      item_ids: body.item_ids,
      note: body.note,
      client_note: body.client_note,
    });
    return NextResponse.json({ day });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}
