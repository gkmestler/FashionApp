import { NextRequest, NextResponse } from "next/server";
import { removeBackground } from "@/lib/providers/background-removal";
import { autoTagImage } from "@/lib/providers/auto-tag";
import { uploadToBucket, BUCKETS } from "@/lib/storage";
import { toPngBuffer } from "@/lib/image";
import { ItemDraft } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/items/upload  (multipart/form-data, field "files" — one or many)
 *
 * For each uploaded photo:
 *  1. save the original to item-originals
 *  2. remove background (swappable) -> save to item-photos (fallback = original)
 *  3. auto-tag with vision -> pre-filled draft
 *
 * Returns an array of DRAFTS. Nothing is written to `clothing_items` here — the
 * Stylist edits and confirms each draft, which POSTs to /api/items.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const drafts: (ItemDraft & { error?: string })[] = [];

  for (const file of files) {
    try {
      const originalBuffer = Buffer.from(await file.arrayBuffer());
      const originalType = file.type || "image/png";
      const originalExt = extFromName(file.name) || extFromType(originalType);

      // 1. original
      const original_image_url = await uploadToBucket(
        BUCKETS.itemOriginals,
        originalBuffer,
        originalType,
        originalExt,
      );

      // 2. background removal (never blocks — falls back to original), then
      //    normalize to PNG so the item photo is always in a format the image
      //    model accepts. If conversion somehow fails, fall back to bg bytes.
      const bg = await removeBackground(originalBuffer, originalType);
      let photoBuffer: Buffer = bg.buffer;
      let photoType = bg.contentType;
      let photoExt = bg.ext;
      try {
        photoBuffer = await toPngBuffer(bg.buffer);
        photoType = "image/png";
        photoExt = "png";
      } catch (convErr) {
        console.error("[upload] PNG conversion failed, storing original bytes:", convErr);
      }

      const image_url = await uploadToBucket(BUCKETS.itemPhotos, photoBuffer, photoType, photoExt);

      // 3. auto-tag (defensive; falls back to sane defaults)
      const tagged = await autoTagImage(photoBuffer, photoType);

      drafts.push({
        ...tagged,
        image_url,
        original_image_url,
      });
    } catch (err) {
      console.error("[upload] item failed:", err);
      drafts.push({
        name: file.name || "New Item",
        category: "other",
        colors: [],
        tags: [],
        image_url: "",
        original_image_url: "",
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  return NextResponse.json({ drafts });
}

function extFromName(name: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toLowerCase() : null;
}
function extFromType(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
}
