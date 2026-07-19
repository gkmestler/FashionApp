"use client";

import { useEffect, useRef, useState } from "react";
import { getMannequin, uploadMannequin } from "@/lib/client-api";
import { downscaleImage, isHeic, UnreadableImageError } from "@/lib/downscale-image";
import { Button, Spinner, ZoomableImage } from "@/components/ui";

/**
 * Upload / set the active mannequin base image. This is the fixed base passed to
 * every generation call, so the same mannequin appears every time. Swappable —
 * uploading a new one deactivates the old and becomes active.
 */
export default function MannequinSettings({ onChange }: { onChange?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const m = await getMannequin();
      setCurrent(m?.base_image_url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mannequin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleFile(file: File) {
    if (isHeic(file)) {
      setError(
        "HEIC photos can't be uploaded. iPhones save as HEIC by default — switch to JPG via Settings ▸ Camera ▸ Formats ▸ “Most Compatible”, or convert the file to JPG/PNG first.",
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      // Shrink client-side first so the base image fits Vercel's body limit.
      const shrunk = await downscaleImage(file);
      const m = await uploadMannequin(shrunk);
      setCurrent(m.base_image_url);
      onChange?.();
    } catch (e) {
      if (e instanceof UnreadableImageError) {
        setError(
          "Couldn't read that image. If it's a screenshot, save it to disk first and upload the saved file (dragging the macOS screenshot preview thumbnail doesn't work).",
        );
      } else {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="max-w-md">
      <h3 className="text-sm font-semibold">Mannequin base image</h3>
      <p className="mt-1 text-sm text-muted">
        This exact figure is dressed in every generated outfit. Upload a clean, full-body
        front-view photo on a plain background for the most consistent results.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-40 w-32 items-center justify-center overflow-hidden rounded-xl border border-border bg-[#1a1a17]">
          {loading ? (
            <Spinner className="h-5 w-5 text-muted" />
          ) : current ? (
            <ZoomableImage src={current} alt="Mannequin base" className="h-full w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-xs text-muted">No base set</span>
          )}
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <>
                <Spinner className="h-4 w-4" /> Uploading…
              </>
            ) : current ? (
              "Replace base"
            ) : (
              "Upload base"
            )}
          </Button>
          {current && <p className="mt-2 text-xs text-muted">Active ✓</p>}
        </div>
      </div>
    </div>
  );
}
