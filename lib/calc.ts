/**
 * Pure calculation functions for the Manual Mode pot system.
 * No I/O, no side effects — safe to call in useMemo.
 */

import type { ManualLeague, WeekEntry, Team, TeamWeekCharge } from "./types";

// ─── Single-week calculation ─────────────────────────────────────────────────

/**
 * Calculates what each team owes for one week.
 *
 * Milestone rules:
 *   0 qualifiers  → no tax collected for this milestone
 *   1 qualifier   → every team EXCEPT the qualifier pays taxPerNonQualifier
 *   2+ qualifiers, exemptIfMultipleQualify = true  → qualifiers exempt, others pay
 *   2+ qualifiers, exemptIfMultipleQualify = false → ALL teams pay (no exemption)
 */
export function calculateWeekTaxes(
  entry: WeekEntry,
  league: ManualLeague
): TeamWeekCharge[] {
  const { teams, config } = league;

  // Build mutable charge records keyed by team id
  const chargeMap = new Map<string, TeamWeekCharge>(
    teams.map((t) => [
      t.id,
      { teamId: t.id, teamName: t.name, amount: 0, reasons: [] },
    ])
  );

  const add = (teamId: string, amount: number, reason: string) => {
    const c = chargeMap.get(teamId);
    if (c) {
      c.amount += amount;
      c.reasons.push(reason);
    }
  };

  // 1. Base penalty — lowest scorer
  if (entry.lowestScorerTeamId) {
    add(entry.lowestScorerTeamId, config.basePenalty, "Lowest scorer");
  }

  // 2. Each milestone rule
  config.milestones.forEach((rule, i) => {
    const qualifiers =
      entry.milestoneResults[i]?.qualifyingTeamIds ?? [];
    const payers = getMilestonePayers(teams, qualifiers, rule.exemptIfMultipleQualify);
    const label =
      rule.type === "points"
        ? `Below ${rule.threshold} pt threshold`
        : `Below ${rule.threshold} TD threshold`;
    payers.forEach((id) => add(id, rule.taxPerNonQualifier, label));
  });

  return Array.from(chargeMap.values());
}

function getMilestonePayers(
  teams: Team[],
  qualifierIds: string[],
  exemptIfMultiple: boolean
): string[] {
  if (qualifierIds.length === 0) return [];

  if (qualifierIds.length === 1) {
    // Single qualifier is exempt, everyone else pays
    return teams.filter((t) => t.id !== qualifierIds[0]).map((t) => t.id);
  }

  // 2+ qualifiers
  if (exemptIfMultiple) {
    const exempt = new Set(qualifierIds);
    return teams.filter((t) => !exempt.has(t.id)).map((t) => t.id);
  } else {
    // Toggle off → no exemption, all teams pay
    return teams.map((t) => t.id);
  }
}

// ─── Season aggregation ──────────────────────────────────────────────────────

export interface SeasonRecord {
  team: Team;
  totalOwed: number;
  weekBreakdown: { week: number; amount: number }[];
}

/**
 * Aggregates all week entries into per-team season totals.
 * Returns sorted by totalOwed descending, then team name ascending.
 */
export function calculateSeasonTaxes(
  entries: WeekEntry[],
  league: ManualLeague
): SeasonRecord[] {
  const recordMap = new Map<string, SeasonRecord>(
    league.teams.map((t) => [
      t.id,
      { team: t, totalOwed: 0, weekBreakdown: [] },
    ])
  );

  entries.forEach((entry) => {
    calculateWeekTaxes(entry, league).forEach(({ teamId, amount }) => {
      const r = recordMap.get(teamId);
      if (r && amount > 0) {
        r.totalOwed += amount;
        r.weekBreakdown.push({ week: entry.week, amount });
      }
    });
  });

  return Array.from(recordMap.values()).sort(
    (a, b) => b.totalOwed - a.totalOwed || a.team.name.localeCompare(b.team.name)
  );
}

/** Sum of all taxes across all weeks. */
export function totalPot(entries: WeekEntry[], league: ManualLeague): number {
  return entries.reduce((sum, entry) => {
    return (
      sum + calculateWeekTaxes(entry, league).reduce((s, c) => s + c.amount, 0)
    );
  }, 0);
}
