/**
 * Pure calculation functions for the Manual Mode pot system.
 * No I/O, no side effects — safe to call in useMemo.
 */

import type { ManualLeague, WeekEntry, Team, TeamWeekCharge } from "./types";

// ─── Single-week calculation ─────────────────────────────────────────────────

/**
 * Calculates what each team owes for one week.
 *
 * Teams are sorted by score ascending; the bottom `config.bottomScorersCount`
 * teams each owe `config.basePenalty`. All other teams owe nothing.
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

  const sorted = [...entry.scores].sort((a, b) => a.points - b.points);
  const bottomCount = Math.max(
    1,
    Math.min(config.bottomScorersCount, sorted.length)
  );
  const bottomIds = sorted.slice(0, bottomCount).map((s) => s.teamId);
  const reason = bottomCount > 1 ? "Bottom scorer" : "Lowest scorer";

  bottomIds.forEach((teamId) => {
    const c = chargeMap.get(teamId);
    if (c) {
      c.amount += config.basePenalty;
      c.reasons.push(reason);
    }
  });

  return Array.from(chargeMap.values());
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
