import { getServiceSupabase } from "./supabase/server";
import { randomUUID } from "crypto";

export const BUCKETS = {
  itemPhotos: "item-photos",
  itemOriginals: "item-originals",
  mannequin: "mannequin",
  generated: "generated",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/**
 * Upload a buffer to a public bucket and return its public URL.
 * All uploads happen server-side with the service role key.
 */
export async function uploadToBucket(
  bucket: BucketName,
  buffer: Buffer,
  contentType: string,
  ext = "png",
): Promise<string> {
  const supabase = getServiceSupabase();
  const path = `${randomUUID()}.${ext}`;

  // Wrap the bytes in a Blob before handing them to supabase-js. If you pass a
  // raw Node Buffer, storage-js sends it straight to fetch as the request body;
  // on Vercel's runtime that Buffer gets stringified as UTF-8, which corrupts
  // every byte >= 0x80 into the replacement character (turning the PNG into
  // garbage that 200s but won't decode). A Blob forces storage-js down its
  // FormData path, which is binary-safe on every runtime. `new Uint8Array` makes
  // a tight copy so a pooled Buffer's backing store isn't over-read.
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Storage upload failed (${bucket}): ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Best-effort delete of a stored object given its public URL. Public URLs look
 * like `.../storage/v1/object/public/<bucket>/<path>`, so we pull the segment
 * after the bucket name and hand it to the storage API. Never throws — cleaning
 * up a stray file should not fail the request that owns the DB row.
 */
export async function removeFromBucketByUrl(bucket: BucketName, url: string): Promise<void> {
  try {
    const marker = `/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.slice(idx + marker.length).split("?")[0];
    if (!path) return;
    const supabase = getServiceSupabase();
    await supabase.storage.from(bucket).remove([decodeURIComponent(path)]);
  } catch {
    /* swallow — storage cleanup is best-effort */
  }
}

/**
 * Fetch the bytes behind a stored public URL (used to pass item photos as
 * reference images to the generation endpoint).
 */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
