/**
 * Swappable background-removal provider.
 *
 * Everything goes through `removeBackground(imageBuffer)`. Swap the provider by
 * changing BG_REMOVAL_PROVIDER or editing the switch below — nothing else in the
 * app needs to know how it works.
 *
 * Providers:
 *  - "none"   : no-op passthrough (returns the original bytes). Safe default so
 *               uploads never block and the app runs with zero extra setup.
 *  - "imgly"  : @imgly/background-removal-node (local, model-based). Install it
 *               with `npm i @imgly/background-removal-node` and set
 *               BG_REMOVAL_PROVIDER=imgly. Imported dynamically so the app still
 *               builds/runs when the package isn't installed.
 *  - "removebg": remove.bg hosted API. Set BG_REMOVAL_PROVIDER=removebg and
 *               REMOVE_BG_API_KEY=...
 *
 * Contract: given raw image bytes, return PNG bytes with the background removed.
 * On ANY failure we fall back to the original bytes so upload never fails.
 */

export interface BgRemovalResult {
  buffer: Buffer;
  contentType: string;
  ext: string;
  removed: boolean; // false when we fell back to the original
}

type Provider = "none" | "imgly" | "removebg";

function provider(): Provider {
  return (process.env.BG_REMOVAL_PROVIDER as Provider) || "none";
}

export async function removeBackground(
  imageBuffer: Buffer,
  originalContentType = "image/png",
): Promise<BgRemovalResult> {
  const fallback: BgRemovalResult = {
    buffer: imageBuffer,
    contentType: originalContentType,
    ext: extFromContentType(originalContentType),
    removed: false,
  };

  try {
    switch (provider()) {
      case "imgly":
        return await removeWithImgly(imageBuffer);
      case "removebg":
        return await removeWithRemoveBg(imageBuffer, originalContentType);
      case "none":
      default:
        return fallback;
    }
  } catch (err) {
    console.error("[background-removal] failed, falling back to original:", err);
    return fallback;
  }
}

async function removeWithImgly(imageBuffer: Buffer): Promise<BgRemovalResult> {
  // Dynamic import so a missing optional dependency doesn't break the build.
  const mod = await import(
    /* webpackIgnore: true */ "@imgly/background-removal-node" as string
  ).catch(() => null);

  if (!mod || typeof mod.removeBackground !== "function") {
    throw new Error("@imgly/background-removal-node is not installed");
  }

  const blob = new Blob([new Uint8Array(imageBuffer)]);
  const outBlob: Blob = await mod.removeBackground(blob);
  const buffer = Buffer.from(await outBlob.arrayBuffer());
  return { buffer, contentType: "image/png", ext: "png", removed: true };
}

async function removeWithRemoveBg(
  imageBuffer: Buffer,
  contentType: string,
): Promise<BgRemovalResult> {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) throw new Error("REMOVE_BG_API_KEY not set");

  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(imageBuffer)], { type: contentType }));
  form.append("size", "auto");

  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`remove.bg failed: ${res.status} ${await res.text()}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: "image/png", ext: "png", removed: true };
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  return "png";
}
