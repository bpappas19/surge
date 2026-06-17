"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserLeagues,
  getMembers,
  getManualTeams,
  getWeeklyResults,
  weeklyResultsToEntries,
  leagueRowToManualLeague,
  manualTeamsToLeague,
} from "@/lib/db";
import { totalPot, calculateWeekTaxes } from "@/lib/calc";
import type { LeagueRow, MemberRow } from "@/lib/db";
import type { WeekEntry, ManualLeague } from "@/lib/types";
import { ChevronRight, ChevronDown, Plus, Zap, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeagueCard {
  row: LeagueRow;
  myMember: MemberRow | null;
  allMembers: MemberRow[];
  entries: WeekEntry[];
  adaptedLeague: ManualLeague;
  /** Team id to look up "my" charges in calculateWeekTaxes — manual_teams.id for manual leagues. */
  myTeamId: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weeksPlayed(entries: WeekEntry[]): number {
  if (!entries.length) return 0;
  return Math.max(...entries.map((e) => e.week));
}

function currentPot(card: LeagueCard): number {
  const { row, adaptedLeague, entries } = card;
  const startingPot = row.buy_in * row.team_count;
  // Sleeper leagues don't persist weekly_results to Supabase — the dashboard
  // computes them live from the Sleeper API and caches the total in
  // surge_deposit. Use that field instead of the always-empty entries.
  if (row.mode === "sleeper") {
    return startingPot + (row.surge_deposit ?? 0);
  }
  return startingPot + totalPot(entries, adaptedLeague);
}

function maxPotential(card: LeagueCard): number {
  const { adaptedLeague, entries } = card;
  const played = weeksPlayed(entries);
  const remaining = Math.max(0, (card.row.total_weeks ?? 14) - played);

  const bottomCount = Math.max(
    1,
    Math.min(adaptedLeague.config.bottomScorersCount, adaptedLeague.teams.length)
  );
  const maxPerWeek = adaptedLeague.config.basePenalty * bottomCount;
  return currentPot(card) + remaining * maxPerWeek;
}

function myTaxDebt(card: LeagueCard): number {
  const { myTeamId, adaptedLeague, entries } = card;
  if (!myTeamId) return 0;
  if (card.row.mode !== "manual") return 0;

  let debt = 0;
  for (const entry of entries) {
    const charge = calculateWeekTaxes(entry, adaptedLeague).find(
      (c) => c.teamId === myTeamId
    );
    debt += charge?.amount ?? 0;
  }
  return debt;
}

// ─── LeagueCard component ─────────────────────────────────────────────────────

function LeagueCardView({ card }: { card: LeagueCard }) {
  const { row, myMember } = card;
  const isCommissioner =
    myMember?.role === "commissioner" || row.commissioner_id === myMember?.user_id;

  const pot       = currentPot(card);
  const maxPot    = maxPotential(card);
  const played    = weeksPlayed(card.entries);
  const remaining = Math.max(0, (row.total_weeks ?? 14) - played);
  const debt      = myTaxDebt(card);

  // Season is complete if:
  //   • champion has been explicitly set, OR
  //   • all tracked weeks are played, OR
  //   • the season year is before the current calendar year
  //     (Sleeper leagues don't store weekly_results in Supabase, so remaining
  //      would always be 14 for a finished past season without this check)
  const currentYear = new Date().getFullYear();
  const isComplete =
    !!row.champion_team_id ||
    remaining === 0 ||
    Number(row.season) < currentYear;


  const dashboardHref =
    row.mode === "sleeper"
      ? `/league/${row.sleeper_league_id}`
      : `/m/${row.id}`;

  const totalWeeks = row.total_weeks ?? 14;

  return (
    <div className="bg-[#0d1420] border border-white/6 rounded-2xl overflow-hidden transition-all duration-200 hover:border-white/12 hover:bg-white/3">

      {/* Pot area */}
      <div className="p-5 pb-3">
        {/* Name + badges row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h2 className="text-base font-semibold text-white leading-tight truncate">
              {row.name}
            </h2>
            {isCommissioner && (
              <span className="flex-shrink-0 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                Commissioner
              </span>
            )}
          </div>
          <span className="flex-shrink-0 text-[10px] text-slate-500 border border-white/8 rounded-md px-2 py-0.5">
            {row.mode === "sleeper" ? "Sleeper" : "Manual"}
          </span>
        </div>

        {/* Giant pot number */}
        <p className="text-xs text-slate-500 mb-1.5">
          {isComplete ? "Final pot" : "Current pot"}
        </p>
        <p className="text-4xl font-bold text-white tabular-nums leading-none">
          ${pot.toLocaleString()}
        </p>

        {/* Season complete badge — replaces the "Could reach" growth indicator */}
        {isComplete ? (
          <div className="flex items-center gap-1.5 mt-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" strokeWidth={1.5} />
            <p className="text-sm text-slate-300">Season complete</p>
          </div>
        ) : (
          remaining > 0 && maxPot > pot && pot > 0 && (
            <p className="text-emerald-400 text-sm mt-1.5">
              Could reach ${maxPot.toLocaleString()}
            </p>
          )
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/5 mx-5" />

      {/* Position / week progress */}
      <div className="px-5 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-600 mb-1">Your position</p>
          <p className="text-sm font-medium text-slate-400">
            {isCommissioner ? "Commissioner" : "Member"}
            {!isCommissioner && debt > 0 && (
              <span className="ml-2 text-red-400 tabular-nums font-bold">
                −${debt.toLocaleString()} owed
              </span>
            )}
            {!isCommissioner && debt === 0 && played > 0 && (
              <span className="ml-2 text-emerald-400 text-xs">No debt</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-600 mb-1">Season</p>
          {isComplete ? (
            <p className="text-sm text-slate-500">Complete</p>
          ) : (
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs text-slate-500 tabular-nums">
                Wk {played}/{totalWeeks}
              </span>
              <div className="w-10 h-1 bg-white/6 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500/70 rounded-full"
                  style={{ width: `${Math.min(100, (played / totalWeeks) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-4 flex justify-end">
        <Link
          href={dashboardHref}
          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium flex items-center gap-1 transition-colors"
        >
          View league
          <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-6 sm:p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
        <Zap className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
      </div>
      <p className="text-white font-semibold mb-1">No leagues yet</p>
      <p className="text-sm text-slate-400 mb-6">
        Set up your league to start tracking the pot.
      </p>
      <CTAButtons />
    </div>
  );
}

function EmptyYearState({ year }: { year: string }) {
  return (
    <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-6 sm:p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
        <Zap className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
      </div>
      <p className="text-white font-semibold mb-1">No leagues for {year}</p>
      <p className="text-sm text-slate-400 mb-6">
        You don&apos;t have any Surge leagues set up for the {year} season.
      </p>
      <CTAButtons />
    </div>
  );
}

function CTAButtons() {
  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link
        href="/sleeper"
        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Connect Sleeper
      </Link>
      <Link
        href="/setup"
        className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 text-slate-200 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Manual setup
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaguesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [cards,        setCards]        = useState<LeagueCard[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedYear, setSelectedYear] = useState("");
  const [showPastSeasons, setShowPastSeasons] = useState(false);

  const loadLeagues = useCallback(async () => {
    if (!user) return;

    const rows = await getUserLeagues(supabase, user.id);
    if (!rows.length) {
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const [members, weekRows] = await Promise.all([
          getMembers(supabase, row.id),
          getWeeklyResults(supabase, row.id),
        ]);
        const myMember = members.find((m) => m.user_id === user.id) ?? null;
        const entries   = weeklyResultsToEntries(weekRows, row.id);

        if (row.mode === "manual") {
          const teams        = await getManualTeams(supabase, row.id);
          const adaptedLeague = manualTeamsToLeague(row, teams);
          const myTeam        = teams.find((t) => t.claimed_by_user_id === user.id);
          return { row, myMember, allMembers: members, entries, adaptedLeague, myTeamId: myTeam?.id ?? null };
        }

        const adaptedLeague = leagueRowToManualLeague(row, members);
        return { row, myMember, allMembers: members, entries, adaptedLeague, myTeamId: myMember?.id ?? null };
      })
    );

    setCards(enriched);

    // Default to the most recent season year across all leagues
    const years = [...new Set(enriched.map((c) => c.row.season))]
      .sort((a, b) => Number(b) - Number(a));
    if (years.length) setSelectedYear(years[0]);

    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login?next=/leagues");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user) loadLeagues();
  }, [authLoading, user, loadLeagues]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const years = useMemo(
    () =>
      [...new Set(cards.map((c) => c.row.season))].sort(
        (a, b) => Number(b) - Number(a)
      ),
    [cards]
  );

  const filteredCards = useMemo(
    () => (selectedYear ? cards.filter((c) => c.row.season === selectedYear) : cards),
    [cards, selectedYear]
  );

  // ── Loading ────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-16">
      <div className="w-full max-w-2xl mx-auto px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Your leagues
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Season ends. Winner takes all.
        </p>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 space-y-4">
        {/* League cards or empty state */}
        {cards.length === 0 ? (
          <EmptyState />
        ) : filteredCards.length === 0 ? (
          <EmptyYearState year={selectedYear} />
        ) : (
          filteredCards.map((card) => (
            <LeagueCardView key={card.row.id} card={card} />
          ))
        )}

        {/* Past seasons toggle — only visible when leagues span multiple seasons */}
        {cards.length > 0 && years.length > 1 && (
          <div className="px-1">
            <button
              type="button"
              onClick={() => setShowPastSeasons((v) => !v)}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              View past seasons
            </button>
            {showPastSeasons && (
              <div className="relative inline-block mt-2 ml-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="appearance-none cursor-pointer bg-[#0d1420] border border-white/6 focus:border-emerald-500/40 rounded-lg pl-3.5 pr-9 py-1.5 text-sm text-slate-300 outline-none transition-colors"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none"
                  strokeWidth={1.5}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
