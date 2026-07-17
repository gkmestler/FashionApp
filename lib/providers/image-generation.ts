import { toFile } from "openai";
import { getOpenAI } from "./openai-client";
import { ClothingItem } from "../types";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
// Keep size/quality identical across every call for mannequin consistency.
const IMAGE_SIZE = (process.env.OPENAI_IMAGE_SIZE || "1024x1536") as
  | "1024x1024"
  | "1024x1536"
  | "1536x1024"
  | "auto";

/**
 * Build the fixed prompt template. Only the item list changes between calls;
 * pose/background/framing/lighting language is constant so the mannequin stays
 * consistent day to day.
 */
export function buildPrompt(items: Pick<ClothingItem, "name" | "category">[]): string {
  const list = items.map((i) => `${i.category}: ${i.name}`).join("; ");
  return [
    "Dress this exact mannequin in the clothing items shown in the reference images.",
    "Keep the mannequin's pose, body, background, framing, and lighting identical to the base image.",
    "Only change the clothing. Full-body front view on a plain, evenly lit background.",
    `The mannequin should be wearing: ${list}.`,
    "Match the real colors and styles from the reference photos as closely as possible.",
    "Do not add any extra clothing, accessories, text, or watermark.",
  ].join(" ");
}

export interface GenerationInput {
  mannequinBase: { buffer: Buffer; contentType: string };
  itemImages: { buffer: Buffer; contentType: string }[];
  items: Pick<ClothingItem, "name" | "category">[];
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

  const baseFile = await toFile(input.mannequinBase.buffer, "mannequin.png", {
    type: input.mannequinBase.contentType || "image/png",
  });

  const referenceFiles = await Promise.all(
    input.itemImages.map((img, idx) =>
      toFile(img.buffer, `item-${idx}.png`, { type: img.contentType || "image/png" }),
    ),
  );

  const prompt = buildPrompt(input.items);

  // gpt-image-1 edit accepts an array of images; base first, then references.
  const result = await openai.images.edit({
    model: IMAGE_MODEL,
    image: [baseFile, ...referenceFiles],
    prompt,
    size: IMAGE_SIZE,
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Image generation returned no image data.");
  }
  return Buffer.from(b64, "base64");
}
