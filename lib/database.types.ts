/**
 * Full Supabase database schema types.
 * Used by both browser and server Supabase clients.
 *
 * SQL migrations to run in Supabase SQL editor before using this schema:
 *
 *   -- Add champion tracking (if not already present)
 *   ALTER TABLE leagues ADD COLUMN IF NOT EXISTS champion_team_id text;
 *
 *   -- Add per-league regular-season length
 *   ALTER TABLE leagues ADD COLUMN IF NOT EXISTS total_weeks integer DEFAULT 14;
 *
 *   -- Replace milestone system with "bottom X scorers pay" rule
 *   ALTER TABLE leagues ADD COLUMN IF NOT EXISTS bottom_scorers_count integer DEFAULT 1;
 *
 *   -- Store each team's weekly score instead of a single lowest-scorer id
 *   ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS scores jsonb DEFAULT '[]'::jsonb;
 *   ALTER TABLE weekly_results ALTER COLUMN lowest_scorer_team DROP NOT NULL;
 *
 *   -- Unique constraint for weekly results upsert
 *   ALTER TABLE weekly_results
 *     ADD CONSTRAINT IF NOT EXISTS weekly_results_league_week_key
 *     UNIQUE (league_id, week);
 *
 *   -- Row Level Security
 *   ALTER TABLE leagues          ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE league_members   ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE weekly_results   ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
 *
 *   CREATE POLICY "Public read"   ON leagues         FOR SELECT USING (true);
 *   CREATE POLICY "Auth insert"   ON leagues         FOR INSERT WITH CHECK (auth.uid() = commissioner_id);
 *   CREATE POLICY "Comm update"   ON leagues         FOR UPDATE USING (auth.uid() = commissioner_id);
 *
 *   CREATE POLICY "Public read"   ON league_members  FOR SELECT USING (true);
 *   CREATE POLICY "Self insert"   ON league_members  FOR INSERT WITH CHECK (auth.uid() = user_id);
 *   CREATE POLICY "Self update"   ON league_members  FOR UPDATE USING (auth.uid() = user_id);
 *
 *   CREATE POLICY "Public read"   ON weekly_results  FOR SELECT USING (true);
 *   CREATE POLICY "Auth write"    ON weekly_results  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
 *   CREATE POLICY "Auth update"   ON weekly_results  FOR UPDATE USING (auth.uid() IS NOT NULL);
 *   CREATE POLICY "Auth delete"   ON weekly_results  FOR DELETE USING (auth.uid() IS NOT NULL);
 *
 *   CREATE POLICY "Self read"     ON transactions    FOR SELECT USING (auth.uid() = user_id);
 *   CREATE POLICY "Self insert"   ON transactions    FOR INSERT WITH CHECK (auth.uid() = user_id);
 *
 *   -- Manual league teams: the commissioner's team list, claimable by members
 *   CREATE TABLE IF NOT EXISTS manual_teams (
 *     id uuid primary key default gen_random_uuid(),
 *     league_id uuid references leagues(id),
 *     team_name text not null,
 *     claimed_by_user_id uuid references auth.users(id),
 *     joined_at timestamptz default now()
 *   );
 *
 *   ALTER TABLE manual_teams ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Public read"   ON manual_teams    FOR SELECT USING (true);
 *   CREATE POLICY "Auth insert"   ON manual_teams    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
 *   CREATE POLICY "Auth claim"    ON manual_teams    FOR UPDATE USING (auth.uid() IS NOT NULL);
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = string | number | boolean | null | { [key: string]: any } | any[];

export interface Database {
  public: {
    Tables: {
      leagues: {
        Row: {
          id: string;
          name: string;
          season: string;
          buy_in: number;
          surge_deposit: number;
          team_count: number;
          base_penalty: number;
          milestones: Json;
          sleeper_league_id: string | null;
          mode: "manual" | "sleeper";
          commissioner_id: string;
          champion_team_id: string | null;
          total_weeks: number | null;
          bottom_scorers_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          season: string;
          buy_in: number;
          surge_deposit?: number;
          team_count: number;
          base_penalty: number;
          milestones?: Json;
          sleeper_league_id?: string | null;
          mode: "manual" | "sleeper";
          commissioner_id: string;
          champion_team_id?: string | null;
          total_weeks?: number | null;
          bottom_scorers_count?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leagues"]["Insert"]>;
        Relationships: [];
      };

      league_members: {
        Row: {
          id: string;
          league_id: string;
          user_id: string;
          team_name: string;
          role: "commissioner" | "member";
          stripe_customer_id: string | null;
          deposit_balance: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          user_id: string;
          team_name: string;
          role: "commissioner" | "member";
          stripe_customer_id?: string | null;
          deposit_balance?: number;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["league_members"]["Insert"]>;
        Relationships: [];
      };

      weekly_results: {
        Row: {
          id: string;
          league_id: string;
          week: number;
          /** @deprecated Legacy single lowest-scorer id — superseded by `scores`. */
          lowest_scorer_team: string | null;
          /** @deprecated Legacy milestone qualifier ids — no longer written. */
          milestone_hits: Json;
          /** Each team's score for this week: `{ teamId: string; points: number }[]` */
          scores: Json;
          taxes: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          week: number;
          lowest_scorer_team?: string | null;
          milestone_hits?: Json;
          scores?: Json;
          taxes?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_results"]["Insert"]>;
        Relationships: [];
      };

      transactions: {
        Row: {
          id: string;
          league_id: string;
          user_id: string;
          amount: number;
          type: string;
          stripe_payment_id: string | null;
          week: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          user_id: string;
          amount: number;
          type: string;
          stripe_payment_id?: string | null;
          week?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };

      manual_teams: {
        Row: {
          id: string;
          league_id: string;
          team_name: string;
          claimed_by_user_id: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          team_name: string;
          claimed_by_user_id?: string | null;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["manual_teams"]["Insert"]>;
        Relationships: [];
      };

      // Legacy table — replaced by `leagues` for new flows
      sleeper_league_configs: {
        Row: {
          id: string;
          league_id: string;
          season: string;
          buy_in: number;
          team_count: number;
          base_penalty: number;
          milestones: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          season: string;
          buy_in: number;
          team_count: number;
          base_penalty: number;
          milestones?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sleeper_league_configs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row-shape aliases
export type LeagueRow    = Database["public"]["Tables"]["leagues"]["Row"];
export type MemberRow    = Database["public"]["Tables"]["league_members"]["Row"];
export type WeeklyRow    = Database["public"]["Tables"]["weekly_results"]["Row"];
export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
export type ManualTeamRow  = Database["public"]["Tables"]["manual_teams"]["Row"];
