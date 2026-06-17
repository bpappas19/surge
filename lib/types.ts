// ─── Manual league data model ───────────────────────────────────────────────

export interface Team {
  id: string;       // crypto.randomUUID()
  name: string;     // e.g. "Chasing Mahomes"
  /** User id of the member who has claimed this team, if any (manual leagues). */
  claimedByUserId?: string | null;
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
  /** Amount each bottom scorer pays into the pot per week. Default: 25. */
  basePenalty: number;
  /** How many bottom scorers pay each week (1-6, or "bottom half"). */
  bottomScorersCount: number;
  /** Buy-in per team in dollars — sets the baseline starting pot. */
  buyIn?: number;
  /** @deprecated Kept for backward compatibility — no longer used. */
  milestones?: MilestoneRule[];
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
  /** Each team's score for this week. */
  scores: { teamId: string; points: number }[];
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
