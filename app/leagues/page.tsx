"use client";

import { useEffect, useState, useCallback } from "react";
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
import { ChevronRight, Plus, Zap } from "lucide-react";

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
  const surges = totalPot(entries, adaptedLeague);
  return startingPot + surges;
}

function maxPotential(card: LeagueCard): number {
  const { row, adaptedLeague, entries } = card;
  const milestones = (row.milestones ?? []) as MilestoneRule[];
  const played = weeksPlayed(entries);
  const remaining = Math.max(0, TOTAL_WEEKS - played);

  // max weekly = base penalty + sum(taxPerNonQualifier × team_count per milestone)
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

  // For manual leagues, team id = myMember.id
  // For sleeper leagues, team ids are roster IDs — we can't match without Sleeper data here,
  // so we skip the debt calc for sleeper leagues.
  if (card.row.mode !== "manual") return 0;

  let debt = 0;
  for (const entry of entries) {
    // calculateWeekTaxes equivalent inline (avoid circular import issues)
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

      if (rule.exemptIfMultipleQualify && isQualifier) {
        // exempt — no charge
        return;
      }
      if (!rule.exemptIfMultipleQualify && !multipleExempt) {
        // no exemption mode — everyone pays
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

  const pot = currentPot(card);
  const maxPot = maxPotential(card);
  const played = weeksPlayed(card.entries);
  const remaining = Math.max(0, TOTAL_WEEKS - played);
  const debt = myTaxDebt(card);

  // Progress bar: pot from starting toward maxPot
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
    <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden hover:border-navy-600 transition-colors group">

      {/* Top: name + badges */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
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
        <div className="mb-1">
          <p className="text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-0.5">
            Current pot
          </p>
          <p className="text-4xl font-bold text-emerald-400 tabular-nums leading-none">
            ${pot.toLocaleString()}
          </p>
        </div>

        {/* Could reach */}
        {remaining > 0 && maxPot > pot && (
          <p className="text-xs text-amber-500/70 mt-1.5 tabular-nums">
            Could reach ${maxPot.toLocaleString()} if all milestones hit
          </p>
        )}
      </div>

      {/* Progress bar */}
      {maxPot > startingPot && (
        <div className="px-5 pb-4">
          <div className="h-1 bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500/60 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
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

      {/* Position / debt */}
      <div className="px-5 py-3.5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">
            Your position
          </p>
          <p className="text-xs font-medium text-slate-400">
            {isCommissioner ? "Commissioner" : "Member"}
            {!isCommissioner && debt > 0 && (
              <span className="ml-2 text-red-400 tabular-nums font-semibold">
                −${debt} owed
              </span>
            )}
            {!isCommissioner && debt === 0 && played > 0 && (
              <span className="ml-2 text-emerald-400 text-[11px]">No debt</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">
            Season
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Wk {played}/{TOTAL_WEEKS}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5">
        <Link
          href={dashboardHref}
          className="w-full flex items-center justify-between bg-navy-700 hover:bg-navy-600 border border-navy-600 hover:border-navy-500 rounded-xl px-4 py-3 transition-colors group/btn"
        >
          <span className="text-sm font-medium text-slate-200">
            View league
          </span>
          <ChevronRight
            className="w-4 h-4 text-slate-500 group-hover/btn:text-slate-300 transition-colors"
            strokeWidth={1.5}
          />
        </Link>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

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
          Manual Setup
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaguesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [cards, setCards] = useState<LeagueCard[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeagues = useCallback(async () => {
    if (!user) return;

    const rows = await getUserLeagues(supabase, user.id);
    if (!rows.length) {
      setLoading(false);
      return;
    }

    // Load members + weekly results for every league in parallel
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const [members, weekRows] = await Promise.all([
          getMembers(supabase, row.id),
          getWeeklyResults(supabase, row.id),
        ]);

        const myMember = members.find((m) => m.user_id === user.id) ?? null;
        const entries = weeklyResultsToEntries(weekRows, row.id);
        const adaptedLeague = leagueRowToManualLeague(row, members);

        return { row, myMember, allMembers: members, entries, adaptedLeague };
      })
    );

    setCards(enriched);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login?next=/leagues");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user) {
      loadLeagues();
    }
  }, [authLoading, user, loadLeagues]);

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
      <div className="w-full max-w-2xl mx-auto px-4 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          Your leagues
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Season ends. Winner takes all.
        </p>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 space-y-4">
        {cards.length === 0 ? (
          <EmptyState />
        ) : (
          cards.map((card) => <LeagueCardView key={card.row.id} card={card} />)
        )}
      </div>
    </main>
  );
}
