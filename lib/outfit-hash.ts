import { createHash } from "crypto";

/**
 * An outfit is a SET of item IDs. We sort the IDs, join them, and hash them
 * (SHA-256) to produce a stable `outfit_hash`. The same set of items always
 * produces the same hash regardless of order, so:
 *  - the same combo on two days reuses the cached image
 *  - swapping an item produces a new hash (new image)
 *  - swapping back is a cache hit again
 */
export function computeOutfitHash(itemIds: string[]): string {
  const sorted = [...new Set(itemIds)].sort();
  const joined = sorted.join(",");
  return createHash("sha256").update(joined).digest("hex");
}
