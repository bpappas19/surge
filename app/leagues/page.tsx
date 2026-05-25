"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserLeagues,
  getMembers,
  getWeeklyResults,
  weeklyResultsToEntries,
  leagueRowToManualLeague,
} from "@/lib/db";
import { totalPot } from "@/lib/calc";
import type { LeagueRow, MemberRow } from "@/lib/db";
import type { MilestoneRule, WeekEntry, ManualLeague } from "@/lib/types";
import { ChevronRight, Plus, Zap, Trophy } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeagueCard {
  row: LeagueRow;
  myMember: MemberRow | null;
  allMembers: MemberRow[];
  entries: WeekEntry[];
  adaptedLeague: ManualLeague;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOTAL_WEEKS = 14;

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
  const { row, adaptedLeague, entries } = card;
  const milestones = (row.milestones ?? []) as MilestoneRule[];
  const played = weeksPlayed(entries);
  const remaining = Math.max(0, TOTAL_WEEKS - played);

  const milestoneMax = milestones.reduce(
    (sum, m) => sum + m.taxPerNonQualifier * row.team_count,
    0
  );
  const maxPerWeek = adaptedLeague.config.basePenalty + milestoneMax;
  return currentPot(card) + remaining * maxPerWeek;
}

function myTaxDebt(card: LeagueCard): number {
  const { myMember, adaptedLeague, entries } = card;
  if (!myMember) return 0;
  if (card.row.mode !== "manual") return 0;

  let debt = 0;
  for (const entry of entries) {
    const config = adaptedLeague.config;

    if (entry.lowestScorerTeamId === myMember.id) {
      debt += config.basePenalty;
    }

    config.milestones.forEach((rule, i) => {
      const qualifiers = entry.milestoneResults[i]?.qualifyingTeamIds ?? [];
      if (qualifiers.length === 0) return;
      const isQualifier = qualifiers.includes(myMember.id);
      const multipleExempt =
        qualifiers.length > 1 && rule.exemptIfMultipleQualify;

      if (rule.exemptIfMultipleQualify && isQualifier) return;
      if (!rule.exemptIfMultipleQualify && !multipleExempt) {
        debt += rule.taxPerNonQualifier;
        return;
      }
      if (!isQualifier) {
        debt += rule.taxPerNonQualifier;
      }
    });
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
  const remaining = Math.max(0, TOTAL_WEEKS - played);
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

  const startingPot = row.buy_in * row.team_count;
  const progress =
    maxPot > startingPot
      ? Math.min(100, ((pot - startingPot) / (maxPot - startingPot)) * 100)
      : 0;

  const dashboardHref =
    row.mode === "sleeper"
      ? `/league/${row.sleeper_league_id}`
      : `/m/${row.id}`;

  return (
    <div
      className={`bg-navy-800 border rounded-2xl overflow-hidden transition-colors group ${
        isCommissioner
          ? "border-navy-700 border-l-2 border-l-emerald-500/40 hover:border-l-emerald-500/60"
          : "border-navy-700 hover:border-navy-600"
      }`}
    >

      {/* Pot area */}
      <div
        className="px-5 pt-5 pb-4"
        style={{ background: "linear-gradient(160deg, rgba(9,13,24,0.55) 0%, rgba(17,30,50,0) 100%)" }}
      >
        {/* Name + badges row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <h2 className="text-base font-bold text-slate-100 leading-tight truncate">
              {row.name}
            </h2>
            {isCommissioner && (
              <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded px-1.5 py-0.5">
                Commissioner
              </span>
            )}
          </div>
          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-navy-700 text-slate-400 border border-navy-600 rounded px-1.5 py-0.5">
            {row.mode === "sleeper" ? "Sleeper" : "Manual"}
          </span>
        </div>

        {/* Giant pot number */}
        <p className="text-[11px] font-medium text-slate-500 mb-0.5">
          {isComplete ? "Final pot" : "Current pot"}
        </p>
        <p className="text-4xl font-bold text-emerald-400 tabular-nums leading-none">
          ${pot.toLocaleString()}
        </p>

        {/* Season complete badge — replaces the "Could Nx" growth indicator */}
        {isComplete ? (
          <div className="flex items-center gap-1.5 mt-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-amber-400">Season complete</p>
          </div>
        ) : (
          remaining > 0 && maxPot > pot && pot > 0 && (
            <p className="text-lg font-semibold text-amber-400/75 mt-2 leading-snug">
              Could {Math.round(maxPot / pot)}x
            </p>
          )
        )}
      </div>

      {/* Progress bar — only for active seasons where the pot can still grow */}
      {!isComplete && maxPot > startingPot && (
        <div className="px-5 pb-4">
          <div className="h-[6px] bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500/70 rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                boxShadow: progress > 0 ? "0 0 8px rgba(16, 185, 129, 0.45)" : undefined,
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-slate-700 tabular-nums">
              ${startingPot.toLocaleString()} start
            </span>
            <span className="text-[10px] text-slate-700 tabular-nums">
              ${maxPot.toLocaleString()} max
            </span>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-navy-700 mx-5" />

      {/* Position / week progress */}
      <div className="px-5 py-3.5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] text-slate-600 mb-0.5">Your position</p>
          <p className="text-xs font-medium text-slate-400">
            {isCommissioner ? "Commissioner" : "Member"}
            {!isCommissioner && debt > 0 && (
              <span className="ml-2 text-red-400 tabular-nums font-bold">
                −${debt} owed
              </span>
            )}
            {!isCommissioner && debt === 0 && played > 0 && (
              <span className="ml-2 text-emerald-400 text-[11px]">No debt</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-600 mb-0.5">Season</p>
          <p className="text-xs text-slate-500 tabular-nums">
            {isComplete ? "Complete" : `Wk ${played}/${TOTAL_WEEKS}`}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5">
        <Link
          href={dashboardHref}
          className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl px-4 py-3 transition-colors group/btn"
        >
          <span className="text-sm font-semibold text-white">
            View league
          </span>
          <ChevronRight
            className="w-4 h-4 text-white/70 group-hover/btn:text-white transition-colors"
            strokeWidth={1.75}
          />
        </Link>
      </div>
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl px-6 py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-navy-700 flex items-center justify-center mx-auto mb-4">
        <Zap className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
      </div>
      <p className="text-slate-300 font-semibold mb-1">No leagues yet</p>
      <p className="text-sm text-slate-600 mb-6">
        Set up your league to start tracking the pot.
      </p>
      <CTAButtons />
    </div>
  );
}

function EmptyYearState({ year }: { year: string }) {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl px-6 py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-navy-700 flex items-center justify-center mx-auto mb-4">
        <Zap className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
      </div>
      <p className="text-slate-300 font-semibold mb-1">No leagues for {year}</p>
      <p className="text-sm text-slate-600 mb-6">
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
        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm px-4 py-2.5 rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Connect Sleeper
      </Link>
      <Link
        href="/setup"
        className="flex items-center justify-center gap-2 bg-navy-700 hover:bg-navy-600 border border-navy-600 hover:border-navy-500 text-slate-200 font-medium text-sm px-4 py-2.5 rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Manual setup
      </Link>
    </div>
  );
}

// ─── Year pill selector ───────────────────────────────────────────────────────

function YearPills({
  years,
  selected,
  onChange,
}: {
  years: string[];
  selected: string;
  onChange: (y: string) => void;
}) {
  if (years.length <= 1) return null; // only show if there's something to filter
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
      {years.map((year) => (
        <button
          key={year}
          onClick={() => onChange(year)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
            selected === year
              ? "bg-navy-700 border-emerald-500/60 text-white shadow-[0_0_10px_rgba(16,185,129,0.15)]"
              : "bg-navy-800 border-navy-600 text-slate-400 hover:text-slate-200 hover:border-navy-500"
          }`}
        >
          {year}
        </button>
      ))}
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
        const myMember     = members.find((m) => m.user_id === user.id) ?? null;
        const entries      = weeklyResultsToEntries(weekRows, row.id);
        const adaptedLeague = leagueRowToManualLeague(row, members);
        return { row, myMember, allMembers: members, entries, adaptedLeague };
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
        <div className="w-6 h-6 border-2 border-navy-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-16">
      <div className="w-full max-w-2xl mx-auto px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          Your leagues
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Season ends. Winner takes all.
        </p>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 space-y-4">
        {/* Year pill selector — only visible when leagues span multiple seasons */}
        {years.length > 1 && (
          <YearPills
            years={years}
            selected={selectedYear}
            onChange={setSelectedYear}
          />
        )}

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
      </div>
    </main>
  );
}
