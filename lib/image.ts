import sharp from "sharp";

/**
 * Normalize any uploaded image to a clean PNG.
 *
 * Why PNG: the OpenAI `gpt-image-1` image-edit endpoint reliably accepts PNG
 * but rejects some JPEGs ("Invalid image file or mode"). Converting everything
 * to PNG on upload (and again as a safety net before generation) guarantees the
 * mannequin base and every clothing photo are in a format the model accepts.
 *
 * Also:
 *  - `.rotate()` bakes in EXIF orientation so iPhone photos aren't sideways.
 *  - resized to fit within a sane bound to cut payload size / latency / cost.
 */
const MAX_EDGE = 1536;

export async function toPngBuffer(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

/**
 * Pad an image out to a target aspect ratio (width/height) by adding margins on
 * the short axis, filled with the image's own corner color so the padding blends
 * into the background.
 *
 * Why: gpt-image-1's edit endpoint only outputs fixed sizes (e.g. 1024x1536 =
 * 2:3). If the mannequin base is taller/narrower than that, the endpoint
 * center-crops it to fit — lopping off the head and feet. Pre-padding the base
 * to the exact output ratio means the whole figure fits the frame and comes back
 * uncropped. No-op (just PNG normalize) when the image already matches the ratio.
 */
export async function padToAspect(input: Buffer, ratioW: number, ratioH: number): Promise<Buffer> {
  // Bake EXIF orientation first so width/height are the real displayed dims.
  const base = await sharp(input).rotate().png().toBuffer();
  const meta = await sharp(base).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) return base;

  const target = ratioW / ratioH;
  const current = w / h;
  // Already close enough — avoid pointless re-encode / rounding drift.
  if (Math.abs(current - target) < 0.01) {
    return sharp(base).resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  }

  // Sample the top-left pixel to match the background of the padding.
  const corner = await sharp(base).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  const background = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };

  let extend: { top: number; bottom: number; left: number; right: number };
  if (current < target) {
    // Too tall/narrow → add width on the sides.
    const pad = Math.round(h * target) - w;
    const left = Math.floor(pad / 2);
    extend = { top: 0, bottom: 0, left, right: pad - left };
  } else {
    // Too wide/short → add height top and bottom.
    const pad = Math.round(w / target) - h;
    const top = Math.floor(pad / 2);
    extend = { left: 0, right: 0, top, bottom: pad - top };
  }

  // Two separate pipelines on purpose: within one sharp pipeline, resize is
  // applied BEFORE extend regardless of call order, which would pad the
  // already-shrunk image and land on the wrong aspect ratio. Extend first,
  // materialize, then bound the size.
  const extended = await sharp(base)
    .extend({ ...extend, background })
    .png()
    .toBuffer();

  return sharp(extended)
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}
