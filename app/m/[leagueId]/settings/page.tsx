"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLeagueById,
  getMember,
  updateLeague,
  getManualTeams,
  addManualTeams,
  updateManualTeam,
  deleteManualTeam,
} from "@/lib/db";
import type { ManualTeamRow } from "@/lib/db";
import { BottomScorersSelector, PotGrowthPreview } from "@/components/PotRules";
import {
  ChevronLeft,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────

const inputCls =
  "bg-white/5 border border-white/8 focus:border-emerald-500/40 " +
  "rounded-xl px-3.5 py-2.5 text-sm " +
  "text-white placeholder:text-slate-600 outline-none transition-colors w-full";

const labelCls = "block text-sm text-slate-400 mb-2";

const MIN_TEAMS = 2;
const MAX_TEAMS = 32;

const primaryBtnCls =
  "w-full flex items-center justify-center gap-2 " +
  "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "text-white font-medium rounded-xl py-2.5 text-sm transition-colors";

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ManualSettingsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [supabase] = useState(() => createClient());

  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [teamCount, setTeamCount] = useState(0);

  // Teams
  const [originalTeams, setOriginalTeams] = useState<ManualTeamRow[]>([]);
  const [teamRows, setTeamRows] = useState<{ id?: string; name: string }[]>([]);
  const [savingTeams, setSavingTeams] = useState(false);
  const [teamsSaved, setTeamsSaved] = useState(false);
  const [teamsError, setTeamsError] = useState("");

  // Form state
  const [season, setSeason] = useState(String(currentYear));
  const [buyIn, setBuyIn] = useState("");
  const [basePenalty, setBasePenalty] = useState(25);
  const [bottomScorersCount, setBottomScorersCount] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(14);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth/login?next=/m/${leagueId}/settings`);
      return;
    }

    async function load() {
      const [row, membership, teams] = await Promise.all([
        getLeagueById(supabase, leagueId),
        getMember(supabase, leagueId, user!.id),
        getManualTeams(supabase, leagueId),
      ]);

      if (!row) {
        router.replace(`/m/${leagueId}`);
        return;
      }

      // Non-commissioners get bounced to the dashboard
      if (!membership || membership.role !== "commissioner") {
        router.replace(`/m/${leagueId}`);
        return;
      }

      setLeagueName(row.name);
      setTeamCount(row.team_count);
      setSeason(row.season ?? String(currentYear));
      setBuyIn(String(row.buy_in));
      setBasePenalty(row.base_penalty);
      setBottomScorersCount(row.bottom_scorers_count ?? 1);
      setTotalWeeks(row.total_weeks ?? 14);

      setOriginalTeams(teams);
      setTeamRows(
        teams.length
          ? teams.map((t) => ({ id: t.id, name: t.team_name }))
          : [{ name: "" }, { name: "" }]
      );

      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, leagueId]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError("");

    try {
      await updateLeague(supabase, leagueId, {
        season,
        buy_in: Number(buyIn),
        base_penalty: basePenalty,
        bottom_scorers_count: bottomScorersCount,
        total_weeks: totalWeeks,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Teams ──────────────────────────────────────────────────────────────────

  function setTeamRowCount(n: number) {
    const count = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, n));
    setTeamRows((prev) =>
      count > prev.length
        ? [...prev, ...Array(count - prev.length).fill(null).map(() => ({ name: "" }))]
        : prev.slice(0, count)
    );
  }
  function updateTeamRow(i: number, v: string) { const n = [...teamRows]; n[i] = { ...n[i], name: v }; setTeamRows(n); }
  function removeTeamRow(i: number)           { if (teamRows.length > MIN_TEAMS) setTeamRows(teamRows.filter((_, idx) => idx !== i)); }

  async function handleSaveTeams() {
    setSavingTeams(true);
    setTeamsSaved(false);
    setTeamsError("");

    try {
      const validRows = teamRows
        .map((r) => ({ ...r, name: r.name.trim() }))
        .filter((r) => r.name);

      // Update names that changed
      for (const row of validRows) {
        if (!row.id) continue;
        const original = originalTeams.find((t) => t.id === row.id);
        if (original && original.team_name !== row.name) {
          await updateManualTeam(supabase, row.id, row.name);
        }
      }

      // Add brand-new teams
      const newNames = validRows.filter((r) => !r.id).map((r) => r.name);
      if (newNames.length) {
        await addManualTeams(supabase, leagueId, newNames);
      }

      // Remove teams no longer in the list
      const remainingIds = new Set(validRows.map((r) => r.id).filter(Boolean));
      for (const original of originalTeams) {
        if (!remainingIds.has(original.id)) {
          await deleteManualTeam(supabase, original.id);
        }
      }

      // Keep team_count in sync with the actual team list
      await updateLeague(supabase, leagueId, { team_count: validRows.length });
      setTeamCount(validRows.length);

      const refreshed = await getManualTeams(supabase, leagueId);
      setOriginalTeams(refreshed);
      setTeamRows(
        refreshed.length
          ? refreshed.map((t) => ({ id: t.id, name: t.team_name }))
          : [{ name: "" }, { name: "" }]
      );

      setTeamsSaved(true);
      setTimeout(() => setTeamsSaved(false), 3000);
    } catch (err) {
      setTeamsError(err instanceof Error ? err.message : "Failed to save teams.");
    } finally {
      setSavingTeams(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/6 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const buyInNum = Number(buyIn);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-12">
      <div className="w-full max-w-2xl mx-auto px-4 pt-5 pb-2 flex items-center gap-3">
        <button
          onClick={() => router.push(`/m/${leagueId}`)}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              {leagueName}
            </p>
            <span className="flex-shrink-0 text-[10px] font-bold tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-md px-2 py-0.5">
              Commissioner
            </span>
          </div>
          <p className="text-xs text-slate-600">
            League settings{season ? ` · ${season}` : ""}
          </p>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 space-y-5 mt-2">

        {/* Error banner */}
        {saveError && (
          <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle
              className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
              strokeWidth={1.5}
            />
            <p className="text-red-400 text-sm">{saveError}</p>
          </div>
        )}

        {/* Success banner */}
        {saved && (
          <div className="flex items-center gap-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-3">
            <CheckCircle2
              className="w-4 h-4 text-emerald-400 flex-shrink-0"
              strokeWidth={1.5}
            />
            <p className="text-emerald-400 text-sm font-medium">Settings saved</p>
          </div>
        )}

        {/* Teams */}
        <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6 space-y-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            Teams
          </p>

          {teamsError && (
            <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-red-400 text-sm">{teamsError}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTeamRowCount(teamRows.length - 1)}
              disabled={teamRows.length <= MIN_TEAMS}
              className="w-9 h-9 rounded-xl bg-[#0d1420] border border-white/6 hover:border-white/20 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium select-none"
            >
              −
            </button>
            <span className="text-sm font-semibold text-white tabular-nums w-8 text-center">{teamRows.length}</span>
            <button
              type="button"
              onClick={() => setTeamRowCount(teamRows.length + 1)}
              disabled={teamRows.length >= MAX_TEAMS}
              className="w-9 h-9 rounded-xl bg-[#0d1420] border border-white/6 hover:border-white/20 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium select-none"
            >
              +
            </button>
            <span className="text-xs text-slate-600">teams</span>
          </div>

          <div className="space-y-2">
            {teamRows.map((row, i) => (
              <div key={row.id ?? `new-${i}`} className="flex items-center gap-2.5 border-l-2 border-emerald-500/25 pl-2">
                <span className="text-xs text-slate-700 tabular-nums w-4 text-right flex-shrink-0 select-none">{i + 1}</span>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateTeamRow(i, e.target.value)}
                  placeholder={`Team ${i + 1}`}
                  className={inputCls}
                />
                {teamRows.length > MIN_TEAMS && (
                  <button type="button" onClick={() => removeTeamRow(i)}
                    className="text-slate-700 hover:text-slate-400 transition-colors flex-shrink-0 p-1" aria-label="Remove team">
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {teamsSaved && (
            <div className="flex items-center gap-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
              <p className="text-emerald-400 text-sm font-medium">Teams saved</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveTeams}
            disabled={savingTeams}
            className={primaryBtnCls}
          >
            {savingTeams ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              "Save teams"
            )}
          </button>
        </div>

        {/* Season year + buy-in */}
        <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6 space-y-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            League financials
          </p>

          <div>
            <label className={labelCls}>Season year</label>
            <div className="flex items-center gap-2">
              {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSeason(String(yr))}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    season === String(yr)
                      ? "bg-white/8 border-emerald-500/60 text-white shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                      : "bg-[#0d1420] border-white/8 text-slate-400 hover:text-slate-200 hover:border-white/20"
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Buy-in per team</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none">
                $
              </span>
              <input
                type="number"
                value={buyIn}
                onChange={(e) => setBuyIn(e.target.value)}
                className={`${inputCls} pl-7`}
                min={0}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Regular season length</label>
            <p className="text-xs text-slate-600 -mt-1 mb-3">Most leagues play 14 weeks — adjust if yours differs.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTotalWeeks((w) => Math.max(10, w - 1))}
                disabled={totalWeeks <= 10}
                className="w-9 h-9 rounded-xl bg-[#0d1420] border border-white/6 hover:border-white/20 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium select-none"
              >
                −
              </button>
              <span className="text-sm font-semibold text-white tabular-nums w-8 text-center">{totalWeeks}</span>
              <button
                type="button"
                onClick={() => setTotalWeeks((w) => Math.min(18, w + 1))}
                disabled={totalWeeks >= 18}
                className="w-9 h-9 rounded-xl bg-[#0d1420] border border-white/6 hover:border-white/20 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium select-none"
              >
                +
              </button>
              <span className="text-xs text-slate-600">weeks</span>
            </div>
          </div>
        </div>

        {/* Base penalty */}
        <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <TrendingDown className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-white">
                Bottom scorer penalty
              </p>
            </div>
            <span className="text-xs text-slate-600">Always active</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Each owes</span>
            <div className="relative w-24">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none">
                $
              </span>
              <input
                type="number"
                value={basePenalty === 0 ? "" : basePenalty}
                onChange={(e) =>
                  setBasePenalty(Math.max(0, Number(e.target.value)))
                }
                onFocus={(e) => e.target.select()}
                className={`${inputCls} pl-7 tabular-nums`}
                min={0}
              />
            </div>
            <span className="text-sm text-slate-500">per week</span>
          </div>
        </div>

        {/* Bottom scorers count */}
        <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6">
          <p className="text-sm font-semibold text-white mb-1">How many teams pay each week?</p>
          <p className="text-xs text-slate-600 mb-4">The lowest-scoring teams each week pay into the pot.</p>
          <BottomScorersSelector value={bottomScorersCount} onChange={setBottomScorersCount} teamCount={teamCount} />
        </div>

        {/* Live preview */}
        <PotGrowthPreview bottomScorersCount={bottomScorersCount} basePenalty={basePenalty} totalWeeks={totalWeeks} />

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || buyInNum <= 0}
          className={primaryBtnCls}
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            "Save settings"
          )}
        </button>

      </div>
    </main>
  );
}
