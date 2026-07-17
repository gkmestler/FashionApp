import { getOpenAI } from "./openai-client";
import { CATEGORIES, Category, ItemDraft } from "../types";

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o";

const PROMPT = `You are tagging a single clothing item photographed for a personal wardrobe app.
Return STRICT JSON ONLY. No prose, no markdown, no code fences.

Schema:
{
  "name": string,        // short human name, e.g. "Navy Oxford Shirt"
  "category": one of ${JSON.stringify(CATEGORIES)},
  "colors": string[],    // 1-3 dominant colors as hex codes, e.g. ["#1b2a4a", "#ffffff"]
  "tags": string[]       // 2-6 free-form descriptors, e.g. ["casual", "cotton", "button-up"]
}

Pick the single best category. Use hex color codes for "colors".`;

/**
 * Auto-tag a clothing photo with the vision model, returning structured fields.
 * The result is a DRAFT — the Stylist edits it before saving. Parsing is
 * defensive: we strip fences and fall back to sane defaults on any failure so
 * the upload flow never dies on a bad model response.
 */
export async function autoTagImage(
  imageBuffer: Buffer,
  contentType = "image/png",
): Promise<Pick<ItemDraft, "name" | "category" | "colors" | "tags">> {
  const fallback = {
    name: "New Item",
    category: "other" as Category,
    colors: [] as string[],
    tags: [] as string[],
  };

  try {
    const openai = getOpenAI();
    const dataUrl = `data:${contentType};base64,${imageBuffer.toString("base64")}`;

    const completion = await openai.chat.completions.create({
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseJsonLoose(raw);
    if (!parsed) return fallback;

    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : fallback.name,
      category: normalizeCategory(parsed.category),
      colors: toStringArray(parsed.colors),
      tags: toStringArray(parsed.tags),
    };
  } catch (err) {
    console.error("[auto-tag] failed, using fallback:", err);
    return fallback;
  }
}

function parseJsonLoose(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let text = raw.trim();
  // Strip markdown fences if the model added them despite instructions.
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  // Grab the outermost JSON object if there's surrounding prose.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeCategory(value: unknown): Category {
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if ((CATEGORIES as readonly string[]).includes(lower)) return lower as Category;
  }
  return "other";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === "string")
    .map((v) => (v as string).trim())
    .filter(Boolean)
    .slice(0, 8);
}
