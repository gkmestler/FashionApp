"use client";

import { useState } from "react";
import { CATEGORIES, STATUSES, Category, ItemStatus } from "@/lib/types";
import { ColorSwatchPicker, Button, ZoomableImage } from "@/components/ui";

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
  const addPickedColor = (hex: string) => {
    if (!colors.includes(hex)) setColors([...colors, hex]);
  };
  const changeColor = (index: number, next: string) => {
    setColors(colors.map((c, i) => (i === index ? next : c)));
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
          <ZoomableImage
            src={imageUrl}
            alt={name}
            className="h-28 w-28 shrink-0 rounded-xl border border-border bg-[#1a1a17] object-contain p-1"
          />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-border bg-[#1a1a17] text-xs text-muted">
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
          {colors.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-none border border-border bg-surface py-1 pl-1.5 pr-2 text-xs"
            >
              {/* Click the swatch to change this color; the actual color always shows. */}
              <ColorSwatchPicker
                value={c}
                size={14}
                title={`Change ${c}`}
                onChange={(hex) => changeColor(i, hex)}
              />
              {c}
              <button onClick={() => setColors(colors.filter((_, x) => x !== i))} className="text-muted hover:text-red-600">
                ×
              </button>
            </span>
          ))}
          {colors.length === 0 && <span className="text-xs text-muted">No colors yet</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Pick a color visually, or type a name/hex below. */}
          <ColorSwatchPicker value={colorInput || "#808080"} size={34} title="Pick a color to add" onChange={addPickedColor} />
          <input
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColor())}
            placeholder="Name it (navy) or pick / paste #1b2a4a"
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
              className="inline-flex items-center gap-1.5 rounded-none bg-accent-soft px-2.5 py-1 text-xs text-foreground"
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
                className={`rounded-none border px-3 py-1.5 text-xs capitalize transition ${
                  status === s ? "border-accent bg-accent text-black" : "border-border bg-surface text-muted"
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
