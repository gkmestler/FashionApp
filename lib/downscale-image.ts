"use client";

/**
 * Detect Apple HEIC/HEIF photos, which most desktop browsers can't decode (so
 * we can't downscale them and the upload would 413 or fail). Checked by MIME
 * type and by extension, because the browser often reports an empty type for
 * these files.
 */
export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.includes("heic") || type.includes("heif")) return true;
  return /\.(heic|heif)$/i.test(file.name);
}

/**
 * Shrink an image in the browser BEFORE uploading.
 *
 * Why this exists: Vercel serverless functions reject any request body larger
 * than ~4.5 MB with HTTP 413 ("Payload Too Large") — before our route code (and
 * its sharp resize) ever runs. Phone photos and website screenshots routinely
 * exceed that, so we must resize client-side to guarantee the upload fits.
 *
 * We decode the file, scale it so its longest edge is <= maxEdge, and re-encode
 * as JPEG (far smaller than PNG for photos/screenshots; background removal and
 * PNG normalization still happen server-side afterward).
 *
 * If the browser can't decode the file (e.g. HEIC/HEIF from some iPhones), we
 * return the original untouched so behavior is no worse than before — the server
 * will then either handle or reject it with a clear per-item error.
 */
export async function downscaleImage(
  file: File,
  { maxEdge = 1600, quality = 0.82 }: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  // Not an image (or a format we shouldn't touch) — leave it alone.
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap;
  try {
    // `imageOrientation: "from-image"` bakes in EXIF rotation so portrait phone
    // photos don't come out sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // undecodable (e.g. HEIC) — hand the original to the server
  }

  try {
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // White backing so JPEG (which has no alpha) doesn't turn transparent
    // pixels black — matters for PNG screenshots with transparency.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;

    // If, somehow, the re-encode came out bigger than the original, keep the
    // original (e.g. an already-tiny, already-compressed photo).
    if (blob.size >= file.size && scale === 1) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
