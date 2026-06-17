"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
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
import { ChevronLeft, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-white/5 border border-white/8 focus:border-emerald-500/40 " +
  "rounded-xl px-3.5 py-2.5 text-sm " +
  "text-white placeholder:text-slate-600 outline-none transition-colors tabular-nums";

const labelCls = "block text-xs text-slate-500 mb-2";

// ─── Inner form (uses useSearchParams — must be inside <Suspense>) ────────────

function WeekFormInner() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user }     = useAuth();
  const editWeek     = searchParams.get("week") ? Number(searchParams.get("week")) : null;

  const [supabase] = useState(() => createClient());
  const [league,   setLeague]  = useState<ManualLeague | null>(null);
  const [loading,  setLoading] = useState(true);
  const [saving,   setSaving]  = useState(false);
  const [saveError, setSaveError] = useState("");

  // Form state
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [scores,     setScores]     = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const row = await getLeagueById(supabase, leagueId);
      if (!row) { setLoading(false); return; }

      const [teams, weekRows] = await Promise.all([
        getManualTeams(supabase, leagueId),
        getWeeklyResults(supabase, leagueId),
      ]);

      // Commissioner check — redirect members
      if (user && user.id !== row.commissioner_id) {
        router.replace(`/m/${leagueId}`);
        return;
      }

      const manualLeague = manualTeamsToLeague(row, teams);
      const entries      = weeklyResultsToEntries(weekRows, leagueId);
      const defaultWeek  = editWeek ?? (entries[entries.length - 1]?.week ?? 0) + 1;

      setLeague(manualLeague);
      setWeekNumber(defaultWeek);

      // Pre-fill when editing
      if (editWeek) {
        const existing = entries.find((e) => e.week === editWeek);
        if (existing) {
          const prefill: Record<string, string> = {};
          existing.scores.forEach(({ teamId, points }) => {
            prefill[teamId] = String(points);
          });
          setScores(prefill);
        }
      }

      setLoading(false);
    }
    load();
  }, [supabase, leagueId, editWeek, user, router]);

  const allScoresEntered = useMemo(
    () => !!league && league.teams.every((t) => scores[t.id]?.trim() !== "" && scores[t.id] !== undefined),
    [league, scores]
  );

  const preview = useMemo(() => {
    if (!league || !allScoresEntered) return null;
    const entry: WeekEntry = {
      leagueId,
      week: weekNumber,
      scores: league.teams.map((t) => ({ teamId: t.id, points: Number(scores[t.id]) || 0 })),
      submittedAt: new Date().toISOString(),
    };
    return calculateWeekTaxes(entry, league);
  }, [league, allScoresEntered, scores, weekNumber, leagueId]);

  const previewTotal = preview?.reduce((s, c) => s + c.amount, 0) ?? 0;

  async function submit() {
    if (!league || !allScoresEntered) return;
    setSaving(true);
    setSaveError("");
    try {
      const entryScores = league.teams.map((t) => ({ teamId: t.id, points: Number(scores[t.id]) || 0 }));
      const entry: WeekEntry = {
        leagueId,
        week: weekNumber,
        scores: entryScores,
        submittedAt: new Date().toISOString(),
      };
      const taxes = calculateWeekTaxes(entry, league);
      await upsertWeeklyResult(supabase, {
        leagueId,
        week: weekNumber,
        scores: entryScores,
        taxes,
      });
      router.push(`/m/${leagueId}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save results.");
      setSaving(false);
    }
  }

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

  const bottomCount = Math.max(1, Math.min(league.config.bottomScorersCount, league.teams.length));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-12">
      {/* Inline page header */}
      <div className="w-full max-w-md mx-auto px-4 pt-5 pb-2 flex items-center gap-3">
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

      <div className="w-full max-w-md mx-auto px-4 pb-6 space-y-6">

        {/* ── Week number ── */}
        {!editWeek && (
          <div>
            <label className={labelCls}>Week number</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekNumber((n) => Math.max(1, n - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0d1420] border border-white/6 hover:border-white/20 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <p className="flex-1 text-center text-2xl font-bold text-white tabular-nums">
                {weekNumber}
              </p>
              <button
                type="button"
                onClick={() => setWeekNumber((n) => n + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0d1420] border border-white/6 hover:border-white/20 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* ── Team scores ── */}
        <div>
          <label className={labelCls}>Each team&apos;s score this week</label>
          <p className="text-xs text-slate-600 mb-3">
            The bottom {bottomCount} scorer{bottomCount > 1 ? "s" : ""} will each owe ${league.config.basePenalty.toLocaleString()}.
          </p>
          <div className="space-y-2">
            {league.teams.map((team) => (
              <div key={team.id} className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white flex-1 truncate">{team.name}</span>
                <input
                  type="number"
                  value={scores[team.id] ?? ""}
                  onChange={(e) => setScores((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className={`${inputCls} w-24 text-right`}
                  min={0}
                  step="0.01"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Live preview ── */}
        {preview && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs text-slate-500 uppercase tracking-widest">
                This week&apos;s breakdown
              </p>
              <p className="text-xs font-semibold text-slate-400 tabular-nums">
                +${previewTotal.toLocaleString()} to pot
              </p>
            </div>
            <div className="bg-[#0d1420] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/6">
              {preview.map(({ teamId, teamName, amount, reasons }) => (
                <div key={teamId} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{teamName}</p>
                    {reasons.length > 0 ? (
                      <p className="text-xs text-slate-600 mt-0.5 truncate">
                        {reasons.join(" · ")}
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-600 mt-0.5">No charge</p>
                    )}
                  </div>
                  <p
                    className={`text-sm font-bold tabular-nums flex-shrink-0 ${
                      amount > 0 ? "text-red-400" : "text-slate-600"
                    }`}
                  >
                    {amount > 0 ? `-$${amount.toLocaleString()}` : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Save error ── */}
        {saveError && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-sm text-red-400">{saveError}</p>
          </div>
        )}

        {/* ── Incomplete prompt ── */}
        {!allScoresEntered && (
          <div className="flex items-start gap-2.5 bg-[#0d1420] border border-white/6 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-xs text-slate-600">Enter every team&apos;s score to submit.</p>
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!allScoresEntered || saving}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl py-2.5 text-sm transition-colors"
        >
          {saving ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            editWeek ? `Update week ${editWeek}` : `Submit week ${weekNumber}`
          )}
        </button>

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
