# Build Prompt: Weekly Outfit Stylist Web App

## What we're building

A personal styling web app. One person (the "Stylist") picks outfits for each day of the week from a photographed wardrobe. Another person (the "Wearer") sees those outfits as AI-generated images of a mannequin wearing the selected clothes, revealed one day at a time with an animation.

It's a single shared app with a soft mode toggle between **Stylist view** and **My view**. No separate logins, no PIN. Just a toggle in the header.

Build this to be dead simple to use. The Stylist should be able to build a full week and generate every image in a couple of minutes.

---

## Tech stack (already chosen, do not substitute)

- **Framework:** Next.js (App Router, TypeScript)
- **Hosting:** Vercel
- **Database + Storage + (optional) Auth:** Supabase
- **Version control:** GitHub
- **Image generation:** OpenAI `gpt-image-1` (the image *edit* endpoint, so we pass reference images)
- **Auto-tagging on upload:** OpenAI vision (`gpt-4o` or current equivalent) returning structured JSON
- **Background removal on upload:** use a library or API (see the Upload Pipeline section, make it swappable)
- **Styling:** Tailwind CSS

Set the project up so it runs locally with `npm run dev` and deploys to Vercel cleanly. Use environment variables for all secrets.

---

## Core concepts (read these first, the whole design hangs on them)

### 1. An outfit is a SET of item IDs, and we cache by its hash

The most important design decision. An "outfit" is just the set of clothing item IDs selected for a day (e.g. `{shirt_42, pants_9, shoes_3, jacket_7}`).

- Sort the item IDs, join them, and hash them (SHA-256) to produce an `outfit_hash`.
- Generated mannequin images are stored keyed by `outfit_hash`.
- Before generating, check if an image already exists for that hash. If yes, reuse it. Never regenerate or re-pay for a combo we've already made.
- Because the hash is derived from the item set: the same combo on two different days reuses the image, swapping an item produces a new hash (new image), and swapping back is a cache hit again.

This single mechanism handles caching, swapping, and cost control. Get it right.

### 2. Mannequin consistency via the edit endpoint + reference images

The Wearer's images must show the *same mannequin every time*, only the outfit changing.

- The Stylist uploads a **fixed mannequin base image** once, stored in app settings/config (not hardcoded, so it can be swapped later).
- Every generation call uses `gpt-image-1`'s **image edit** endpoint, passing the mannequin base as the base image every single time.
- Also pass the **actual photos of the selected clothing items** as additional reference images, so the mannequin is dressed in the user's real clothes, not the model's generic idea of the item.
- Use a consistent prompt template every time (see Generation Pipeline) so pose, framing, background, and lighting stay stable.

This won't be 100% perfect. Include a per-day **regenerate** button, and let the Stylist visually approve before it's shown to the Wearer.

### 3. Two views, one soft toggle

Header has a toggle: **Stylist** | **My view**. No auth gating. Stylist view is where clothes are managed and outfits are built. My view is the reveal experience. State persists so the toggle just swaps what's on screen.

---

## Data model (Supabase / Postgres)

Create these tables. Adjust types as sensible, keep the relationships.

### `clothing_items`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| name | text | e.g. "Navy Oxford Shirt" |
| category | text | enum-ish: shirt, sweater, pants, shorts, shoes, socks, suit, jacket, coat, accessory, other |
| colors | text[] | dominant colors, hex or names |
| tags | text[] | free-form: casual, formal, cotton, button-up, etc. |
| image_url | text | background-removed item photo (Supabase Storage) |
| original_image_url | text | pre-background-removal original (keep it) |
| status | text | active / washing / retired (default active) |
| created_at | timestamptz | |

### `mannequin_config`
| column | type | notes |
|---|---|---|
| id | uuid, pk | single row, or keep history |
| base_image_url | text | the fixed mannequin photo |
| is_active | boolean | which base is currently used |
| created_at | timestamptz | |

### `generated_outfits`
The cache. One row per unique outfit combination.
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| outfit_hash | text, unique | SHA-256 of sorted item IDs |
| item_ids | uuid[] | the items in this outfit |
| image_url | text | generated mannequin image (Supabase Storage) |
| palette | jsonb | dominant colors extracted from the real item photos |
| created_at | timestamptz | |

### `week_plans`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| week_start | date | Monday of the week, unique |
| created_at | timestamptz | |

### `day_outfits`
One row per day of a week.
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| week_plan_id | uuid, fk → week_plans | |
| day_of_week | int | 0 to 6 |
| item_ids | uuid[] | selected items for the day |
| outfit_hash | text | matches generated_outfits.outfit_hash |
| note | text | Stylist's note for the day |
| revealed | boolean | has the Wearer revealed this day yet (default false) |
| created_at / updated_at | timestamptz | |

Add indexes on `outfit_hash` (both tables), `week_plans.week_start`, and `day_outfits.week_plan_id`.

---

## Supabase Storage buckets

- `item-photos` — background-removed item images
- `item-originals` — raw uploads before processing
- `mannequin` — the base mannequin image(s)
- `generated` — generated mannequin outfit images

Make buckets public-read (or use signed URLs) so the Next.js app can display images. Uploads happen server-side via the service role key.

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Never expose the service role or OpenAI key to the client. All OpenAI calls and privileged Supabase writes go through Next.js API routes / server actions.

---

## Feature spec by view

### STYLIST VIEW

#### A. Wardrobe management

- Grid of all clothing items with photo, name, category. Background-removed images on clean cards.
- **Search and filter:** by name text search, by category, by tag, by color. Fast and prominent, since the wardrobe will get large.
- Each item card: click to edit (name, category, colors, tags, status) or delete.
- Item `status` (active / washing / retired): non-active items are visually dimmed and cannot be selected into an outfit.

#### B. Upload pipeline (this is the ease-of-use centerpiece)

When the Stylist uploads a photo (support multiple at once):

1. Save the original to `item-originals`.
2. **Background removal:** produce a clean-on-transparent/white version, save to `item-photos`. Implement this behind a single swappable function `removeBackground(imageBuffer)` so the provider can be changed. Reasonable default: the `@imgly/background-removal-node` package, or a hosted API. If it fails, fall back to using the original image so upload never blocks.
3. **Auto-tagging:** send the image to the vision model with a prompt that returns **strict JSON only**:
   ```json
   {
     "name": "Navy Oxford Shirt",
     "category": "shirt",
     "colors": ["navy", "white"],
     "tags": ["casual", "cotton", "button-up"]
   }
   ```
   Prompt the model to output only JSON, no prose, no markdown fences. Parse defensively (strip fences if present, try/catch).
4. Show the Stylist a **confirmation card** pre-filled with the auto-tagged values. **She can edit every field before saving.** Save on confirm. This edit-before-save step is required, not optional.

Uploading one item should feel like: drop photo → glance at the pre-filled card → tap confirm.

#### C. Weekly outfit builder

- Pick/create a week (defaults to the current week, Monday start).
- Seven day columns/cards: Mon through Sun.
- For each day: an "add items" action opens the searchable wardrobe picker (same search/filter as wardrobe management). Tap items to add them to that day. Selected items show as thumbnails on the day.
- Per day: a **note** text field for the Stylist.
- Removing/swapping an item from a day is just editing that day's item set. When the set changes, its `outfit_hash` recomputes.
- Live per-day **color palette** strip, extracted from the **real item photos** (not the generated image), so it's accurate.

#### D. Generate the week

- One prominent **"Generate Week"** button.
- On click, for each day:
  - Compute `outfit_hash`.
  - If a `generated_outfits` row already exists for that hash → reuse it instantly, no API call.
  - If not → call the generation pipeline.
- **Run generations in parallel** (all uncached days at once), with a **live progress bar** showing X of N complete. Handle individual failures gracefully (mark that day failed, offer retry) without killing the whole batch.
- Per-day **regenerate** button that forces a fresh generation and overwrites the cached image for that hash.
- Let the Stylist see the generated images to approve before the Wearer sees them.

### MY VIEW (the Wearer)

- Seven day cards for the current week.
- **Tap-to-reveal:** each day starts "wrapped." Tapping it plays a fun reveal animation (e.g. flip or unwrap/fade-in) that reveals: the mannequin image, the list of items in the outfit, the color palette, and the Stylist's note. Set `day_outfits.revealed = true` on reveal.
- **Master "Reveal All" toggle** in the header: flips every day open at once to see the whole week flat, and can be toggled back off. Default is wrapped/surprise mode.
- Clean, satisfying, mobile-friendly. This view is meant to feel like a small daily treat.

---

## Generation pipeline (detail)

Server-side API route, e.g. `POST /api/generate-outfit` taking `{ item_ids: [...] }`.

1. Compute `outfit_hash` from sorted `item_ids`. If a cached row exists, return it immediately.
2. Load the active mannequin base image from `mannequin_config`.
3. Load the background-removed photos of each selected item.
4. Call `gpt-image-1` **image edit** with:
   - Base image = mannequin base (always the same).
   - Additional reference images = the selected clothing item photos.
   - A **fixed prompt template**, e.g.:
     > "Dress this exact mannequin in the clothing items shown in the reference images. Keep the mannequin's pose, body, background, framing, and lighting identical to the base image. Only change the clothing. Full-body front view. The mannequin should be wearing: [category + name of each item]. Match the real colors and styles from the reference photos."
   - Keep size, background, and style parameters identical across all calls for consistency.
5. Save the returned image to the `generated` bucket.
6. Extract the palette from the real item photos and store it.
7. Insert the `generated_outfits` row keyed by `outfit_hash`. Return the image URL + palette.

For "Generate Week," fan this route out in parallel across the uncached days and stream/poll progress back to the progress bar.

**Vercel note:** image generation is slow (30–60s+ each). Set `maxDuration` appropriately on the generation route (e.g. `export const maxDuration = 300;` on a plan that allows it), and rely on parallelism + the progress bar so the UI never feels frozen. If any single day exceeds the limit, surface a per-day retry rather than failing the whole week.

---

## API routes / server actions to build

- `POST /api/items/upload` — handle original save, background removal, auto-tag, return pre-filled draft.
- `POST /api/items` — create item (on Stylist confirm).
- `PATCH /api/items/:id` — edit item.
- `DELETE /api/items/:id` — delete item.
- `GET /api/items` — list with search/filter params.
- `POST /api/mannequin` — upload/set active mannequin base.
- `POST /api/generate-outfit` — single outfit (with cache check).
- `POST /api/generate-week` — batch, parallel, returns progress-trackable results.
- `GET/POST/PATCH /api/week` — load/create/update a week and its day outfits, notes, item sets.
- `PATCH /api/day/:id/reveal` — mark a day revealed.

---

## Build order (milestones)

1. **Scaffold:** Next.js + Tailwind + Supabase client, env wired, deploys to Vercel. GitHub repo initialized.
2. **Schema + buckets:** create all tables and storage buckets. Seed nothing.
3. **Upload pipeline:** upload → background removal → auto-tag → confirm/edit → save. Wardrobe grid with search/filter/edit/delete.
4. **Mannequin config:** upload and set the active base image.
5. **Week builder:** day cards, item picker, notes, per-day palette, hash computation.
6. **Generation + caching:** single-outfit route with cache check, then Generate Week (parallel + progress bar), regenerate button.
7. **My view:** wrapped day cards, reveal animation, reveal-all toggle, palette + items + note display.
8. **Polish:** mode toggle, mobile layout, loading/empty/error states, retry flows.

Ship each milestone working before moving on.

---

## Constraints and reminders

- Keep it **super simple to use**. Prioritize speed of the weekly build and the upload flow over feature depth.
- Never expose secret keys client-side.
- Every generated image must be saved and cached by `outfit_hash`. Never regenerate a combo that already exists (except explicit regenerate).
- Auto-tagging must always be editable before save.
- Mannequin base is a swappable config value, not hardcoded.
- Make background removal and image generation providers swappable behind clean function boundaries.
- Handle failures per-item and per-day so one failure never breaks a batch.
- Mobile-friendly, especially My view.

Start with Milestone 1 and confirm it runs and deploys before continuing.