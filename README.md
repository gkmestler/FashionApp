# Weekly Outfit Stylist 🧵

A personal styling web app. One person (the **Stylist**) picks outfits for each day
of the week from a photographed wardrobe. Another person (the **Wearer**) sees those
outfits as AI-generated images of a mannequin wearing the selected clothes, revealed
one day at a time.

One shared app, no logins — a soft **Stylist / My view** toggle in the header.

- **Framework:** Next.js (App Router, TypeScript) + Tailwind CSS v4
- **Data / storage:** Supabase (Postgres + Storage)
- **Image generation:** OpenAI `gpt-image-1` image *edit* endpoint (mannequin base + real item photos as references)
- **Auto-tagging:** OpenAI vision (`gpt-4o`) returning strict JSON
- **Background removal:** swappable (`none` | `imgly` | `remove.bg`)

---

## How it works (the key idea)

An **outfit is a SET of item IDs**. We sort the IDs, join them, and SHA-256 them into
an `outfit_hash`. Generated mannequin images are cached by that hash, so:

- the same combo on two days reuses one image,
- swapping an item makes a new hash (new image),
- swapping back is a cache hit.

Every generation uses the **same mannequin base image** via the edit endpoint plus the
**real photos** of the selected clothes, so the mannequin stays consistent and wears
your actual wardrobe. See `lib/outfit-hash.ts`, `lib/generate.ts`, and
`lib/providers/image-generation.ts`.

---

## 1. Setup Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run [`supabase/migration.sql`](supabase/migration.sql).
   This creates all tables + indexes and the four public storage buckets
   (`item-photos`, `item-originals`, `mannequin`, `generated`).
3. From **Project Settings → API**, copy the Project URL, the `anon` key, and the
   `service_role` key.

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
```

The service role and OpenAI keys are **server-only** — they're never sent to the browser.
All privileged work happens in the API routes under `app/api/*`.

Optional:

```
BG_REMOVAL_PROVIDER=none      # none (default) | imgly | removebg
REMOVE_BG_API_KEY=...         # only for removebg
OPENAI_VISION_MODEL=gpt-4o
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1024x1536
```

## 3. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### First-run checklist
1. **Stylist → Mannequin:** upload a full-body, front-view mannequin photo on a plain
   background. A starter image is provided in `Photos/Mannequin.png`.
2. **Stylist → Wardrobe:** drop some clothing photos. Each is background-removed,
   auto-tagged, and shown as a pre-filled card — edit anything, then confirm to save.
3. **Stylist → Week:** add items to each day, add notes, then **Generate week**.
4. **My view:** tap each day to reveal it, or **Reveal all**.

---

## Background removal (swappable)

Everything goes through `removeBackground()` in
`lib/providers/background-removal.ts`. The default (`none`) is a passthrough so uploads
never block. To enable real removal:

- **imgly (local):** `npm i @imgly/background-removal-node` then set `BG_REMOVAL_PROVIDER=imgly`.
- **remove.bg (hosted):** set `BG_REMOVAL_PROVIDER=removebg` and `REMOVE_BG_API_KEY=...`.

If a provider fails, it falls back to the original image automatically.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com/new).
3. Add the same environment variables in **Project → Settings → Environment Variables**.
4. Deploy.

**Note:** image generation is slow (30–60s+ per outfit). The generation routes set
`export const maxDuration = 300`. That requires a Vercel plan that allows long function
durations; on Hobby, lower it or expect timeouts on large batches. The UI runs
generations in parallel with a live progress bar and per-day retry, so one slow/failed
day never blocks the rest.

---

## API routes

| Route | Purpose |
|---|---|
| `POST /api/items/upload` | save original → remove bg → auto-tag → return draft |
| `GET/POST /api/items` | list (search/filter) / create on confirm |
| `PATCH/DELETE /api/items/:id` | edit / delete |
| `GET/POST /api/mannequin` | read / set active mannequin base |
| `POST /api/generate-outfit` | single outfit (cache-checked) |
| `POST /api/generate-week` | server-side parallel batch |
| `GET/POST/PATCH /api/week` | load/create a week, update a day's items & note |
| `PATCH /api/day/:id/reveal` | mark a day revealed |

## Project layout

```
app/            pages + API routes
components/     stylist/ and my/ views + shared ui
lib/            hashing, supabase clients, storage, palette, week math
lib/providers/  swappable openai + background-removal boundaries
supabase/       migration.sql
```
