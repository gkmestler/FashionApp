-- Weekly Outfit Stylist — schema + storage buckets.
-- Run this in the Supabase SQL editor (or `supabase db push`) once per project.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists clothing_items (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'New Item',
  category text not null default 'other',
  colors text[] not null default '{}',
  tags text[] not null default '{}',
  image_url text not null,
  original_image_url text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists mannequin_config (
  id uuid primary key default gen_random_uuid(),
  base_image_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists generated_outfits (
  id uuid primary key default gen_random_uuid(),
  outfit_hash text not null unique,
  item_ids uuid[] not null default '{}',
  image_url text not null,
  palette jsonb not null default '[]',
  note text,
  archived_at timestamptz,  -- non-null = archived (hidden from the active Looks grid)
  created_at timestamptz not null default now()
);

-- If you created generated_outfits before the "look note" feature, add the
-- column to your existing database:
--   alter table generated_outfits add column if not exists note text;
alter table generated_outfits add column if not exists note text;

-- If you created generated_outfits before the "archived looks" feature, add the
-- column to your existing database:
--   alter table generated_outfits add column if not exists archived_at timestamptz;
alter table generated_outfits add column if not exists archived_at timestamptz;

-- If you created day_outfits before the "note from the Wearer" feature, add the
-- column to your existing database:
--   alter table day_outfits add column if not exists client_note text;
alter table day_outfits add column if not exists client_note text;

create table if not exists week_plans (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  created_at timestamptz not null default now()
);

create table if not exists day_outfits (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references week_plans(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  item_ids uuid[] not null default '{}',
  outfit_hash text,
  note text,          -- the Stylist's styling note (feeds the generation prompt)
  client_note text,   -- the Wearer's note to the Stylist (never feeds the prompt)
  revealed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_plan_id, day_of_week)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_generated_outfits_hash on generated_outfits(outfit_hash);
create index if not exists idx_generated_outfits_archived on generated_outfits(archived_at);
create index if not exists idx_day_outfits_hash on day_outfits(outfit_hash);
create index if not exists idx_week_plans_week_start on week_plans(week_start);
create index if not exists idx_day_outfits_week_plan on day_outfits(week_plan_id);

-- Keep updated_at fresh on day_outfits.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_day_outfits_updated_at on day_outfits;
create trigger trg_day_outfits_updated_at
  before update on day_outfits
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage buckets (public-read; uploads happen server-side w/ service role)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('item-photos', 'item-photos', true),
  ('item-originals', 'item-originals', true),
  ('mannequin', 'mannequin', true),
  ('generated', 'generated', true)
on conflict (id) do nothing;

-- Note on RLS: this app performs all privileged reads/writes through Next.js
-- server routes using the SERVICE ROLE key, which bypasses RLS. The tables are
-- therefore left with RLS disabled (Supabase default for new tables created via
-- SQL). If you later expose the anon key for direct client reads, enable RLS
-- and add read-only policies as appropriate.
