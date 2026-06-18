"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLeagueById,
  getManualTeams,
  getWeeklyResults,
  manualTeamsToLeague,
  weeklyResultsToEntries,
  upsertWeeklyResult,
} from "@/lib/db";
import { calculateWeekTaxes } from "@/lib/calc";
import type { ManualLeague, WeekEntry } from "@/lib/types";
import { ChevronLeft, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

// ─── Inner form (uses useSearchParams — must be inside <Suspense>) ────────────

function WeekFormInner() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user }     = useAuth();
  const editWeek     = searchParams.get("week") ? Number(searchParams.get("week")) : null;

  const [supabase]    = useState(() => createClient());
  const [league,      setLeague]     = useState<ManualLeague | null>(null);
  const [allEntries,  setAllEntries] = useState<WeekEntry[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState(false);
  const [saved,       setSaved]      = useState(false);
  const [saveError,   setSaveError]  = useState("");
  const [weekNumber,  setWeekNumber] = useState(1);
  const [selected,    setSelected]   = useState<string[]>([]); // team IDs in tap order (FIFO)

  // Load selection state for any given week from existing entries
  function applyWeekSelection(week: number, lg: ManualLeague, entries: WeekEntry[]) {
    const existing = entries.find((e) => e.week === week);
    if (!existing) { setSelected([]); return; }

    const taxes    = calculateWeekTaxes(existing, lg);
    const taxedIds = taxes.filter((t) => t.amount > 0).map((t) => t.teamId);
    const bc       = Math.max(1, Math.min(lg.config.bottomScorersCount, lg.teams.length));
    const flip     = bc === lg.teams.length - 1;
    if (flip) {
      const winnerId = lg.teams.find((t) => !taxedIds.includes(t.id))?.id;
      setSelected(winnerId ? [winnerId] : []);
    } else {
      setSelected(taxedIds);
    }
  }

  useEffect(() => {
    async function load() {
      const row = await getLeagueById(supabase, leagueId);
      if (!row) { setLoading(false); return; }

      const [teams, weekRows] = await Promise.all([
        getManualTeams(supabase, leagueId),
        getWeeklyResults(supabase, leagueId),
      ]);

      if (user && user.id !== row.commissioner_id) {
        router.replace(`/m/${leagueId}`);
        return;
      }

      const manualLeague = manualTeamsToLeague(row, teams);
      const entries      = weeklyResultsToEntries(weekRows, leagueId);
      const defaultWeek  = editWeek ?? (entries[entries.length - 1]?.week ?? 0) + 1;

      setLeague(manualLeague);
      setAllEntries(entries);
      setWeekNumber(defaultWeek);
      applyWeekSelection(defaultWeek, manualLeague, entries);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, leagueId, editWeek, user, router]);

  // ── Loading / not found ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/6 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-slate-400 text-sm">League not found.</p>
        <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          Back to home
        </Link>
      </div>
    );
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const bottomCount = Math.max(1, Math.min(league.config.bottomScorersCount, league.teams.length));
  const isFlipped   = bottomCount === league.teams.length - 1;
  const target      = isFlipped ? 1 : bottomCount;
  const isReady     = selected.length === target;
  const isExisting  = allEntries.some((e) => e.week === weekNumber);

  function stepWeek(delta: number) {
    const next = Math.max(1, weekNumber + delta);
    setWeekNumber(next);
    applyWeekSelection(next, league!, allEntries);
  }

  function toggle(teamId: string) {
    setSelected((prev) => {
      if (prev.includes(teamId)) return prev.filter((id) => id !== teamId);
      if (prev.length >= target) return [...prev.slice(1), teamId]; // FIFO
      return [...prev, teamId];
    });
  }

  async function submit() {
    if (!league || !isReady) return;
    setSaving(true);
    setSaveError("");

    try {
      const loserIds = isFlipped
        ? league.teams.filter((t) => !selected.includes(t.id)).map((t) => t.id)
        : selected;

      const scores = league.teams.map((t) => ({
        teamId: t.id,
        points: loserIds.includes(t.id) ? 0 : 100,
      }));

      const entry: WeekEntry = {
        leagueId,
        week: weekNumber,
        scores,
        submittedAt: new Date().toISOString(),
      };
      const taxes = calculateWeekTaxes(entry, league);

      await upsertWeeklyResult(supabase, { leagueId, week: weekNumber, scores, taxes });

      setSaved(true);
      setTimeout(() => router.push(`/m/${leagueId}`), 1000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save results.");
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-12">

      {/* Page header */}
      <div className="w-full max-w-md mx-auto px-4 pt-5 pb-4 flex items-center gap-3">
        <Link
          href={`/m/${leagueId}`}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            {editWeek ? `Edit week ${editWeek}` : `Week ${weekNumber}`}
          </p>
          <p className="text-xs text-slate-600">{league.name}</p>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 space-y-5">

        {/* Week stepper — hidden when coming from a direct edit link */}
        {!editWeek && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => stepWeek(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 hover:border-white/20 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <p className="text-sm font-semibold text-white tabular-nums w-16 text-center">
              Week {weekNumber}
            </p>
            <button
              type="button"
              onClick={() => stepWeek(1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 hover:border-white/20 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
            </button>
            {isExisting && (
              <span className="text-xs text-slate-600">editing</span>
            )}
          </div>
        )}

        {/* Instruction + counter */}
        <div>
          <p className="text-base font-semibold text-white mb-1">
            {isFlipped
              ? "Select this week's highest scorer"
              : `Select the ${bottomCount} lowest scorer${bottomCount > 1 ? "s" : ""}`}
          </p>
          <p className="text-xs text-slate-500">{selected.length} of {target} selected</p>
        </div>

        {/* Team cards */}
        <div className="space-y-2">
          {league.teams.map((team) => {
            const isSelected = selected.includes(team.id);
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => toggle(team.id)}
                className={`w-full py-4 px-5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? isFlipped
                      ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                      : "bg-red-500/10 border-red-500/40 text-white"
                    : "bg-white/3 border-white/8 text-slate-300 hover:border-white/20"
                }`}
              >
                <span className="text-sm font-semibold">{team.name}</span>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {saveError && (
          <p className="text-sm text-red-400">{saveError}</p>
        )}

        {/* Submit / saved */}
        {saved ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-emerald-400">Week {weekNumber} saved</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!isReady || saving}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : isExisting || editWeek ? (
              `Update week ${editWeek ?? weekNumber}`
            ) : (
              `Submit week ${weekNumber}`
            )}
          </button>
        )}

      </div>
    </main>
  );
}

// ─── Page export — Suspense wrapper required for useSearchParams ──────────────

export default function WeekFormPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy-950 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/6 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      }
    >
      <WeekFormInner />
    </Suspense>
  );
}
