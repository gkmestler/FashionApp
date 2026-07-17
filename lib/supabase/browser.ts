import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client using the public anon key. Only used for reads that
 * are safe to expose; all privileged writes go through server API routes.
 * (The current UI talks to API routes for everything, but this is here for any
 * future direct client reads.)
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey);
}
