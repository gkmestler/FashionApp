import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { generateForItems } from "@/lib/generate";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/generate-week  { week_plan_id }
 *
 * Server-side batch: generates every day that has items, in parallel, reusing
 * the cache. Failures are per-day (Promise.allSettled) so one bad day never
 * kills the batch. Returns a result per day.
 *
 * NOTE: the UI's live progress bar drives generation by fanning out
 * /api/generate-outfit per uncached day so it can update X-of-N as each
 * resolves. This route is the equivalent one-shot batch for convenience/API use.
 */
export async function POST(req: NextRequest) {
  let body: { week_plan_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.week_plan_id) {
    return NextResponse.json({ error: "week_plan_id is required" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: days, error } = await supabase
    .from("day_outfits")
    .select("id, day_of_week, item_ids, note")
    .eq("week_plan_id", body.week_plan_id)
    .order("day_of_week", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const target = (days ?? []).filter((d) => (d.item_ids?.length ?? 0) > 0);

  const settled = await Promise.allSettled(
    target.map((d) =>
      generateForItems(d.item_ids as string[], { note: (d.note as string) ?? undefined }),
    ),
  );

  const results = target.map((d, i) => {
    const s = settled[i];
    if (s.status === "fulfilled") {
      return { day_id: d.id, day_of_week: d.day_of_week, ok: true, ...s.value };
    }
    return {
      day_id: d.id,
      day_of_week: d.day_of_week,
      ok: false,
      error: s.reason instanceof Error ? s.reason.message : "Generation failed",
    };
  });

  return NextResponse.json({
    total: results.length,
    succeeded: results.filter((r) => r.ok).length,
    results,
  });
}
