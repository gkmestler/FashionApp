import { toFile } from "openai";
import { getOpenAI } from "./openai-client";
import { ClothingItem } from "../types";
import { colorName, suggestBackground } from "../palette";

// The fields the prompt describes for each item.
type PromptItem = Pick<ClothingItem, "name" | "category" | "colors" | "tags">;

// gpt-image-2 is OpenAI's most advanced image model and gives the best identity
// preservation for the wearer's face. Override via env if needed.
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
// Keep size/quality identical across every call for a consistent look.
const IMAGE_SIZE = (process.env.OPENAI_IMAGE_SIZE || "1024x1536") as
  | "1024x1024"
  | "1024x1536"
  | "1536x1024"
  | "auto";
// High quality → sharper faces / fabric detail (slower + pricier). low|medium|high|auto.
const IMAGE_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || "high") as
  | "low"
  | "medium"
  | "high"
  | "auto";

/**
 * The pixel dimensions the model actually outputs. Callers pad the mannequin
 * base to this exact aspect ratio so the full figure fits the output frame
 * instead of being center-cropped by the edit endpoint.
 */
export const IMAGE_DIMENSIONS: { width: number; height: number } = (() => {
  if (IMAGE_SIZE === "auto") return { width: 1024, height: 1536 };
  const [w, h] = IMAGE_SIZE.split("x").map(Number);
  return { width: w, height: h };
})();

/**
 * Build the fixed prompt template. Only the item list changes between calls;
 * pose/background/framing/lighting language is constant so the mannequin stays
 * consistent day to day.
 */
export function buildPrompt(items: PromptItem[], background: string): string {
  // One descriptive line per item: name, category, its true colors (as words),
  // and style tags. This text is what disambiguates a poorly-lit photo — e.g. an
  // olive sweater that photographed nearly black.
  const lines = items.map((i) => {
    const parts = [`${i.name} (${i.category})`];
    const colors = (i.colors ?? []).map(colorName).filter(Boolean);
    if (colors.length) parts.push(`color: ${unique(colors).join(", ")}`);
    const tags = (i.tags ?? []).filter(Boolean);
    if (tags.length) parts.push(`style: ${tags.join(", ")}`);
    return `- ${parts.join("; ")}`;
  });

  return [
    "Turn the FIRST reference image (a photo of one specific real person) into a clean, full-body studio outfit shot of that same person.",

    // --- Identity lock (character consistency) ---
    "IDENTITY — highest priority: the person must be instantly recognizable as the exact same individual as in the first reference image. Reproduce their face precisely and identically: same face shape and proportions, forehead and hairline, hair color/length/texture/parting, eyebrows, eye shape/color/spacing, nose shape and width, cheekbones, mouth and lip shape, jawline, chin, ears, any facial hair, freckles or marks, and the exact same skin tone and complexion.",
    "Do NOT beautify, smooth, slim, age, de-age, restyle, or idealize the face or hair in any way. It is the same head, unchanged — only the clothing and background change.",
    "Keep the same natural head angle, facial expression, and forward-facing standing stance as the base photo, with the same realistic body proportions and build. Neutral relaxed pose, arms at the sides.",

    // --- Outfit ---
    "Remove whatever the person is currently wearing (for example a wetsuit) and dress them in ONLY the clothing items shown in the OTHER reference images.",
    "The person should be wearing:",
    lines.join("\n"),
    "Use those reference photos for each item's exact shape, cut, fit, pattern, and details.",
    "Use each item's stated color and name to determine its TRUE color: if a reference photo looks dark, dim, or washed out, trust the stated color/name over the photo's apparent color (an item named or colored 'olive' must appear olive, not black).",

    // --- Fixed framing / background (kept constant for a consistent series) ---
    `Replace the original background entirely with a solid, seamless ${background} studio backdrop with no scenery, props, shadows on the wall, or gradients.`,
    "Composition, framing, camera distance, and lighting must be identical every time: a straight-on eye-level full-body fashion-lookbook shot, the person centered, shown from the top of the head down to the feet with even margins on all sides. Do not crop or cut off the head, hair, hands, or feet. Soft, even, neutral studio lighting.",
    "Do not add any extra clothing, accessories, text, logos, or watermark.",
  ].join("\n");
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

function extFor(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

export interface GenerationInput {
  mannequinBase: { buffer: Buffer; contentType: string };
  itemImages: { buffer: Buffer; contentType: string }[];
  items: PromptItem[];
}

/**
 * Generate a mannequin-wearing-the-outfit image via gpt-image-1's IMAGE EDIT
 * endpoint. The mannequin base is always the first image; the selected clothing
 * photos are passed as additional reference images. Returns raw PNG bytes.
 *
 * Swap the generation provider by editing this function — callers only see
 * `generateOutfitImage`.
 */
export async function generateOutfitImage(input: GenerationInput): Promise<Buffer> {
  const openai = getOpenAI();

  const baseType = input.mannequinBase.contentType || "image/png";
  const baseFile = await toFile(input.mannequinBase.buffer, `mannequin.${extFor(baseType)}`, {
    type: baseType,
  });

  const referenceFiles = await Promise.all(
    input.itemImages.map((img, idx) => {
      const type = img.contentType || "image/png";
      return toFile(img.buffer, `item-${idx}.${extFor(type)}`, { type });
    }),
  );

  const background = suggestBackground(input.items);
  const prompt = buildPrompt(input.items, background);

  // The image-edit endpoint accepts an array of images; base first, then refs.
  // input_fidelity=high boosts face/detail preservation, but ONLY the
  // gpt-image-1 family supports it (gpt-image-2 rejects the param).
  const result = await openai.images.edit({
    model: IMAGE_MODEL,
    image: [baseFile, ...referenceFiles],
    prompt,
    size: IMAGE_SIZE,
    quality: IMAGE_QUALITY,
    n: 1,
    ...(IMAGE_MODEL.startsWith("gpt-image-1") ? { input_fidelity: "high" as const } : {}),
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Image generation returned no image data.");
  }
  return Buffer.from(b64, "base64");
}
