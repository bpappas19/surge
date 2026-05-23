import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PotConfig {
  id: string;
  league_id: string;
  penalty_amount: number;
  season: string;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      pot_configs: {
        Row: PotConfig;
        Insert: Omit<PotConfig, "id" | "created_at">;
        Update: Partial<Omit<PotConfig, "id" | "created_at">>;
      };
    };
  };
};

// ─── Client ────────────────────────────────────────────────────────────────

let _client: SupabaseClient<Database> | null = null;

/** Returns a Supabase client, or null if env vars aren't set. */
export function getSupabase(): SupabaseClient<Database> | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient<Database>(url, key);
  return _client;
}

/** Get the penalty amount for a league (falls back to $25 default). */
export async function getPenaltyAmount(leagueId: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 25;
  const { data } = await sb
    .from("pot_configs")
    .select("penalty_amount")
    .eq("league_id", leagueId)
    .maybeSingle();
  return (data as { penalty_amount: number } | null)?.penalty_amount ?? 25;
}
