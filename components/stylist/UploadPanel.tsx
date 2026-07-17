"use client";

import { useRef, useState } from "react";
import { uploadFiles, createItem } from "@/lib/client-api";
import { ItemDraft } from "@/lib/types";
import ItemForm, { ItemFormValues } from "./ItemForm";
import { Button, Spinner } from "@/components/ui";

type Draft = ItemDraft & { error?: string; _key: string };

/**
 * Upload flow: drop photos → server removes bg + auto-tags → a pre-filled
 * confirmation card per item → edit anything → Confirm saves it. Edit-before-save
 * is required, so nothing is written until the Stylist confirms each card.
 */
export default function UploadPanel({ onSaved }: { onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const result = await uploadFiles(list);
      setDrafts((prev) => [
        ...result.map((d, i) => ({ ...d, _key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}` })),
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function saveDraft(draft: Draft, values: ItemFormValues) {
    setSavingKey(draft._key);
    setError(null);
    try {
      await createItem({
        name: values.name,
        category: values.category,
        colors: values.colors,
        tags: values.tags,
        image_url: draft.image_url,
        original_image_url: draft.original_image_url,
      });
      setDrafts((prev) => prev.filter((d) => d._key !== draft._key));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4" /> Processing photos…
          </div>
        ) : (
          <>
            <div className="mb-1 text-2xl">📸</div>
            <p className="text-sm font-medium">Drop clothing photos or tap to upload</p>
            <p className="mt-1 text-xs text-muted">
              Background removed & auto-tagged. You confirm each before it&apos;s saved.
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {drafts.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Confirm {drafts.length} item{drafts.length > 1 ? "s" : ""}
          </p>
          {drafts.map((draft) => (
            <div key={draft._key} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              {draft.error ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-red-700">Failed: {draft.error}</p>
                  <Button
                    variant="ghost"
                    onClick={() => setDrafts((prev) => prev.filter((d) => d._key !== draft._key))}
                  >
                    Dismiss
                  </Button>
                </div>
              ) : (
                <ItemForm
                  imageUrl={draft.image_url}
                  showStatus={false}
                  initial={{ name: draft.name, category: draft.category, colors: draft.colors, tags: draft.tags }}
                  submitLabel={savingKey === draft._key ? "Saving…" : "Confirm & save"}
                  submitting={savingKey === draft._key}
                  onSubmit={(values) => saveDraft(draft, values)}
                  extraActions={
                    <Button
                      variant="ghost"
                      onClick={() => setDrafts((prev) => prev.filter((d) => d._key !== draft._key))}
                    >
                      Discard
                    </Button>
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
