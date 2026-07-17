"use client";

import { useState } from "react";
import { CATEGORIES, STATUSES, Category, ItemStatus } from "@/lib/types";
import { ColorDots, Button } from "@/components/ui";

export interface ItemFormValues {
  name: string;
  category: Category;
  colors: string[];
  tags: string[];
  status: ItemStatus;
}

/**
 * Editable fields for a clothing item. Used both by the upload confirmation
 * card (edit-before-save is required) and the wardrobe edit modal.
 */
export default function ItemForm({
  initial,
  imageUrl,
  showStatus = true,
  onSubmit,
  submitLabel,
  submitting,
  extraActions,
}: {
  initial: Partial<ItemFormValues>;
  imageUrl: string;
  showStatus?: boolean;
  onSubmit: (values: ItemFormValues) => void;
  submitLabel: string;
  submitting?: boolean;
  extraActions?: React.ReactNode;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [category, setCategory] = useState<Category>(initial.category ?? "other");
  const [status, setStatus] = useState<ItemStatus>(initial.status ?? "active");
  const [colors, setColors] = useState<string[]>(initial.colors ?? []);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [colorInput, setColorInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const addColor = () => {
    const v = colorInput.trim();
    if (v && !colors.includes(v)) setColors([...colors, v]);
    setColorInput("");
  };
  const addTag = () => {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="h-28 w-28 shrink-0 rounded-xl border border-border bg-[#f4efe8] object-contain p-1"
          />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-border bg-[#f4efe8] text-xs text-muted">
            no image
          </div>
        )}
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navy Oxford Shirt"
            className="mb-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <label className="mb-1 block text-xs font-medium text-muted">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Colors */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Colors</label>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {colors.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-1 text-xs"
            >
              <span
                className="h-3 w-3 rounded-full border border-black/10"
                style={{ backgroundColor: c.startsWith("#") ? c : undefined }}
              />
              {c}
              <button onClick={() => setColors(colors.filter((x) => x !== c))} className="text-muted hover:text-red-600">
                ×
              </button>
            </span>
          ))}
          {colors.length === 0 && <ColorDots colors={colors} />}
        </div>
        <div className="flex gap-2">
          <input
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColor())}
            placeholder="#1b2a4a or navy"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <Button variant="outline" onClick={addColor}>
            Add
          </Button>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Tags</label>
        <div className="mb-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-foreground"
            >
              {t}
              <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-muted hover:text-red-600">
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="casual, cotton, button-up"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <Button variant="outline" onClick={addTag}>
            Add
          </Button>
        </div>
      </div>

      {showStatus && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Status</label>
          <div className="flex gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-full border px-3 py-1.5 text-xs capitalize transition ${
                  status === s ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between gap-2">
        <div>{extraActions}</div>
        <Button onClick={() => onSubmit({ name: name.trim() || "New Item", category, colors, tags, status })} disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
