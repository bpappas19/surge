// ─── Manual league data model ───────────────────────────────────────────────

export interface Team {
  id: string;       // crypto.randomUUID()
  name: string;     // e.g. "Chasing Mahomes"
}

/** A single scoring milestone (points or touchdowns). */
export interface MilestoneRule {
  type: "points" | "touchdowns";
  /** Minimum value to "clear" the milestone. */
  threshold: number;
  /** Dollar amount each non-qualifier owes when milestone is triggered. */
  taxPerNonQualifier: number;
  /**
   * When true and 2+ teams clear, those teams are exempt — everyone else pays.
   * When false and 2+ teams clear, ALL teams pay (no exemption).
   */
  exemptIfMultipleQualify: boolean;
}

export interface LeagueConfig {
  /** Lowest-scorer penalty, always active. Default: 25. */
  basePenalty: number;
  /** 0, 1, or 2 optional milestone rules. */
  milestones: MilestoneRule[];
  /** Buy-in per team in dollars — sets the baseline starting pot. */
  buyIn?: number;
}

export interface ManualLeague {
  id: string;
  name: string;
  teams: Team[];
  config: LeagueConfig;
  /** Roster ID of the designated champion (set by commissioner at season end). */
  championTeamId?: string;
  createdAt: string; // ISO
}

// ─── Weekly entry ───────────────────────────────────────────────────────────

export interface WeekEntry {
  leagueId: string;
  week: number;
  /** Team that scored lowest this week. */
  lowestScorerTeamId: string;
  /**
   * One record per milestone in league.config.milestones (same index order).
   * qualifyingTeamIds: teams that CLEARED the milestone threshold.
   */
  milestoneResults: {
    qualifyingTeamIds: string[];
  }[];
  submittedAt: string; // ISO
}

// ─── Calculation output ─────────────────────────────────────────────────────

export interface TeamWeekCharge {
  teamId: string;
  teamName: string;
  /** Total dollar amount owed this week (may be 0). */
  amount: number;
  /** Human-readable reasons, e.g. ["Lowest scorer", "Below 130 pts"]. */
  reasons: string[];
}
