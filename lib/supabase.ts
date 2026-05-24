import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { MilestoneRule } from "./types";

// ─── Schema ────────────────────────────────────────────────────────────────
//
// Run this SQL in your Supabase SQL editor to create the table:
//
//   create table sleeper_league_configs (
//     id           uuid primary key default gen_random_uuid(),
//     league_id    text not null unique,
//     season       text not null,
//     buy_in       integer not null default 0,
//     team_count   integer not null default 0,
//     base_penalty integer not null default 25,
//     milestones   jsonb not null default '[]',
//     created_at   timestamptz default now(),
//     updated_at   timestamptz default now()
//   );

export interface SleeperLeagueConfig {
  id?: string;
  league_id: string;
  season: string;
  buy_in: number;
  team_count: number;
  base_penalty: number;
  milestones: MilestoneRule[];
  created_at?: string;
  updated_at?: string;
}

export type Database = {
  public: {
    Tables: {
      sleeper_league_configs: {
        Row: Required<SleeperLeagueConfig>;
        Insert: Omit<SleeperLeagueConfig, "id" | "created_at"> & { updated_at?: string };
        Update: Partial<Omit<SleeperLeagueConfig, "id" | "created_at">>;
      };
    };
  };
};

// ─── Client ────────────────────────────────────────────────────────────────

let _client: SupabaseClient<Database> | null = null;

/** Returns a Supabase client, or null if env vars aren't configured. */
export function getSupabase(): SupabaseClient<Database> | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient<Database>(url, key);
  return _client;
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

/**
 * Fetches the stored config for a Sleeper league.
 * Returns null if not found or Supabase is unavailable.
 */
export async function getLeagueConfig(
  leagueId: string
): Promise<SleeperLeagueConfig | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("sleeper_league_configs")
    .select("*")
    .eq("league_id", leagueId)
    .maybeSingle();
  if (error) {
    console.error("[Surge] getLeagueConfig:", error.message);
    return null;
  }
  return data ?? null;
}

/**
 * Creates or updates the config for a Sleeper league.
 * Throws if Supabase is not configured or the write fails.
 */
export async function upsertLeagueConfig(
  config: Omit<SleeperLeagueConfig, "id" | "created_at" | "updated_at">
): Promise<void> {
  const sb = getSupabase();
  if (!sb)
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("sleeper_league_configs")
    .upsert(
      { ...config, updated_at: new Date().toISOString() },
      { onConflict: "league_id" }
    );
  if (error) throw new Error(error.message);
}
