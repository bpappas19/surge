/**
 * Domain-level database helpers.
 * All functions accept a Supabase client (DB) as the first argument
 * so callers control whether they use the browser or server client.
 *
 * Team IDs in manual leagues = league_members.id (Supabase UUID).
 * Team IDs in Sleeper leagues = Sleeper roster_id as string (unchanged).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeagueRow, MemberRow, WeeklyRow } from "./database.types";
import type { MilestoneRule, ManualLeague, WeekEntry, TeamWeekCharge } from "./types";

type DB = SupabaseClient<Database>;

// ─── Leagues ─────────────────────────────────────────────────────────────────

export async function createLeague(
  db: DB,
  data: {
    name: string;
    season: string;
    buyIn: number;
    teamCount: number;
    basePenalty: number;
    milestones: MilestoneRule[];
    mode: "manual" | "sleeper";
    sleeperLeagueId?: string;
    commissionerId: string;
  }
): Promise<LeagueRow> {
  const { data: row, error } = await db
    .from("leagues")
    .insert({
      name: data.name,
      season: data.season,
      buy_in: data.buyIn,
      surge_deposit: 0,
      team_count: data.teamCount,
      base_penalty: data.basePenalty,
      milestones: data.milestones as Database["public"]["Tables"]["leagues"]["Insert"]["milestones"],
      mode: data.mode,
      sleeper_league_id: data.sleeperLeagueId ?? null,
      commissioner_id: data.commissionerId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function getLeagueById(
  db: DB,
  id: string
): Promise<LeagueRow | null> {
  const { data, error } = await db
    .from("leagues")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[Surge] getLeagueById:", error.message);
    return null;
  }
  return data;
}

export async function getLeagueBySleeperLeagueId(
  db: DB,
  sleeperLeagueId: string
): Promise<LeagueRow | null> {
  const { data, error } = await db
    .from("leagues")
    .select("*")
    .eq("sleeper_league_id", sleeperLeagueId)
    .maybeSingle();
  if (error) {
    console.error("[Surge] getLeagueBySleeperLeagueId:", error.message);
    return null;
  }
  return data;
}

export async function updateLeague(
  db: DB,
  id: string,
  patch: Partial<Pick<LeagueRow, "champion_team_id" | "base_penalty" | "buy_in">> & {
    milestones?: MilestoneRule[];
  }
): Promise<void> {
  const { milestones, ...rest } = patch;
  type LeagueUpdate = Database["public"]["Tables"]["leagues"]["Update"];
  const update: LeagueUpdate = { ...rest };
  if (milestones !== undefined) {
    update.milestones = milestones as LeagueUpdate["milestones"];
  }
  const { error } = await db
    .from("leagues")
    .update(update)
    .eq("id", id);
  if (error) console.error("[Surge] updateLeague:", error.message);
}

export async function getUserLeagues(
  db: DB,
  userId: string
): Promise<LeagueRow[]> {
  const { data: memberships, error: e1 } = await db
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId);
  if (e1 || !memberships?.length) return [];

  const ids = memberships.map((m) => m.league_id);
  const { data: leagues, error: e2 } = await db
    .from("leagues")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (e2) return [];
  return leagues ?? [];
}

// ─── League members ──────────────────────────────────────────────────────────

export async function getMember(
  db: DB,
  leagueId: string,
  userId: string
): Promise<MemberRow | null> {
  const { data, error } = await db
    .from("league_members")
    .select("*")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function addMember(
  db: DB,
  leagueId: string,
  userId: string,
  role: "commissioner" | "member",
  teamName: string
): Promise<MemberRow> {
  // Upsert to handle duplicate join attempts gracefully
  const { data, error } = await db
    .from("league_members")
    .upsert(
      {
        league_id: leagueId,
        user_id: userId,
        role,
        team_name: teamName,
        deposit_balance: 0,
      },
      { onConflict: "league_id,user_id" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMembers(
  db: DB,
  leagueId: string
): Promise<MemberRow[]> {
  const { data, error } = await db
    .from("league_members")
    .select("*")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function updateMemberStripeCustomer(
  db: DB,
  memberId: string,
  stripeCustomerId: string
): Promise<void> {
  const { error } = await db
    .from("league_members")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("id", memberId);
  if (error) console.error("[Surge] updateMemberStripeCustomer:", error.message);
}

// ─── Weekly results ──────────────────────────────────────────────────────────

export async function upsertWeeklyResult(
  db: DB,
  data: {
    leagueId: string;
    week: number;
    lowestScorerTeam: string;
    milestoneHits: string[][];
    taxes: TeamWeekCharge[];
  }
): Promise<void> {
  // Delete then insert to avoid needing a unique constraint migration
  await db
    .from("weekly_results")
    .delete()
    .eq("league_id", data.leagueId)
    .eq("week", data.week);

  const { error } = await db.from("weekly_results").insert({
    league_id: data.leagueId,
    week: data.week,
    lowest_scorer_team: data.lowestScorerTeam,
    milestone_hits: data.milestoneHits as Database["public"]["Tables"]["weekly_results"]["Insert"]["milestone_hits"],
    taxes: data.taxes as Database["public"]["Tables"]["weekly_results"]["Insert"]["taxes"],
  });
  if (error) throw new Error(error.message);
}

export async function getWeeklyResults(
  db: DB,
  leagueId: string
): Promise<WeeklyRow[]> {
  const { data, error } = await db
    .from("weekly_results")
    .select("*")
    .eq("league_id", leagueId)
    .order("week", { ascending: true });
  if (error) return [];
  return data ?? [];
}

// ─── DB → domain adapters ────────────────────────────────────────────────────

/**
 * Reconstructs a ManualLeague from DB rows.
 * Team IDs = league_members.id (not user_id).
 */
export function leagueRowToManualLeague(
  row: LeagueRow,
  members: MemberRow[]
): ManualLeague {
  return {
    id: row.id,
    name: row.name,
    teams: members.map((m) => ({ id: m.id, name: m.team_name })),
    config: {
      basePenalty: row.base_penalty,
      milestones: (row.milestones ?? []) as MilestoneRule[],
      buyIn: row.buy_in,
    },
    championTeamId: row.champion_team_id ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Reconstructs WeekEntry[] from WeeklyRow[].
 * lowestScorerTeamId maps to league_members.id for manual leagues,
 * or Sleeper roster_id string for Sleeper leagues.
 */
export function weeklyResultsToEntries(
  rows: WeeklyRow[],
  leagueId: string
): WeekEntry[] {
  return rows.map((row) => {
    const hits = (row.milestone_hits ?? []) as string[][];
    return {
      leagueId,
      week: row.week,
      lowestScorerTeamId: row.lowest_scorer_team,
      milestoneResults: hits.map((qualifyingTeamIds) => ({ qualifyingTeamIds })),
      submittedAt: row.created_at,
    };
  });
}

// Re-export row types for convenience
export type { LeagueRow, MemberRow, WeeklyRow };
