// Shared domain types for the Weekly Outfit Stylist app.

export const CATEGORIES = [
  "shirt",
  "sweater",
  "pants",
  "shorts",
  "shoes",
  "socks",
  "suit",
  "jacket",
  "coat",
  "accessory",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["active", "washing", "retired"] as const;
export type ItemStatus = (typeof STATUSES)[number];

export interface ClothingItem {
  id: string;
  name: string;
  category: Category;
  colors: string[];
  tags: string[];
  image_url: string;
  original_image_url: string | null;
  status: ItemStatus;
  created_at: string;
}

export interface MannequinConfig {
  id: string;
  base_image_url: string;
  is_active: boolean;
  created_at: string;
}

export interface GeneratedOutfit {
  id: string;
  outfit_hash: string;
  item_ids: string[];
  image_url: string;
  palette: PaletteEntry[];
  created_at: string;
}

export interface PaletteEntry {
  hex: string;
  name: string;
}

export interface WeekPlan {
  id: string;
  week_start: string; // ISO date (Monday)
  created_at: string;
}

export interface DayOutfit {
  id: string;
  week_plan_id: string;
  day_of_week: number; // 0..6 (Mon..Sun)
  item_ids: string[];
  outfit_hash: string | null;
  note: string | null;
  revealed: boolean;
  created_at: string;
  updated_at: string;
}

// The auto-tag draft returned by the upload route before the Stylist confirms.
export interface ItemDraft {
  name: string;
  category: Category;
  colors: string[];
  tags: string[];
  image_url: string;
  original_image_url: string;
}

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
