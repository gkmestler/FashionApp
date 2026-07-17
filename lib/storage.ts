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

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
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
