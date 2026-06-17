import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { MilestoneRule } from "./types";
import type { Database } from "./database.types";

// ─── Legacy config interface (sleeper_league_configs table) ─────────────────

export interface SleeperLeagueConfig {
  id?: string;
  league_id: string;
  season: string;
  buy_in: number;
  team_count: number;
  base_penalty: number;
  bottom_scorers_count?: number;
  /** @deprecated Kept for backward compatibility — no longer used. */
  milestones?: MilestoneRule[];
  created_at?: string;
  updated_at?: string;
}

export type { Database };

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
  if (!data) return null;
  return {
    ...data,
    milestones: (data.milestones ?? []) as MilestoneRule[],
  };
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
