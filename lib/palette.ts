import { ClothingItem, PaletteEntry } from "./types";

// A small map so named colors from auto-tagging still render as swatches.
const NAMED_COLORS: Record<string, string> = {
  black: "#111111",
  white: "#f5f5f5",
  gray: "#9ca3af",
  grey: "#9ca3af",
  charcoal: "#374151",
  navy: "#1b2a4a",
  blue: "#2563eb",
  "light blue": "#93c5fd",
  "sky blue": "#7dd3fc",
  teal: "#0d9488",
  green: "#16a34a",
  olive: "#5b6b2f",
  khaki: "#b6a179",
  tan: "#d2b48c",
  beige: "#e3d5b8",
  cream: "#f3ead3",
  brown: "#6b4a2b",
  red: "#dc2626",
  maroon: "#7f1d1d",
  burgundy: "#6b1f2a",
  orange: "#ea580c",
  yellow: "#eab308",
  mustard: "#d4a017",
  pink: "#ec4899",
  purple: "#7c3aed",
  lavender: "#c4b5fd",
  gold: "#c8a951",
  silver: "#c0c5cc",
  denim: "#3b5a80",
};

/** Normalize a color string (hex or name) to a hex code for a swatch. */
export function toHex(color: string): string {
  const c = color.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(c)) {
    return c.length === 4
      ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
      : c;
  }
  if (NAMED_COLORS[c]) return NAMED_COLORS[c];
  // Deterministic fallback color derived from the string, so unknown names
  // still get a stable swatch instead of nothing.
  let hash = 0;
  for (let i = 0; i < c.length; i++) hash = (hash * 31 + c.charCodeAt(i)) & 0xffffff;
  return `#${hash.toString(16).padStart(6, "0")}`;
}

/**
 * Build a per-outfit palette from the REAL item photos' auto-tagged colors
 * (accurate to the actual clothes, not the generated image). De-dupes by hex
 * and caps the strip length.
 */
export function buildPalette(items: Pick<ClothingItem, "colors">[]): PaletteEntry[] {
  const seen = new Set<string>();
  const palette: PaletteEntry[] = [];
  for (const item of items) {
    for (const color of item.colors || []) {
      const hex = toHex(color);
      if (seen.has(hex)) continue;
      seen.add(hex);
      palette.push({ hex, name: color });
      if (palette.length >= 8) return palette;
    }
  }
  return palette;
}
