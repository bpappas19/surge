"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLeagueBySleeperLeagueId,
  getMember,
  updateLeague,
} from "@/lib/db";
import { BottomScorersSelector, PotGrowthPreview } from "@/components/PotRules";
import {
  ChevronLeft,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────

const inputCls =
  "bg-white/5 border border-white/8 focus:border-emerald-500/40 " +
  "rounded-xl px-3.5 py-2.5 text-sm " +
  "text-white placeholder:text-slate-600 outline-none transition-colors w-full";

const labelCls = "block text-sm text-slate-400 mb-2";

const primaryBtnCls =
  "w-full flex items-center justify-center gap-2 " +
  "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "text-white font-medium rounded-xl py-2.5 text-sm transition-colors";

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SleeperLeagueEditPage() {
  // leagueId here is the Sleeper league_id (from the URL), not the Supabase UUID
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [supabase] = useState(() => createClient());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // The Supabase UUID for this league row (needed for updateLeague)
  const [supabaseLeagueId, setSupabaseLeagueId] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [season, setSeason] = useState("");

  // Form state
  const [buyIn, setBuyIn] = useState("");
  const [basePenalty, setBasePenalty] = useState(25);
  const [bottomScorersCount, setBottomScorersCount] = useState(1);
  const [teamCount, setTeamCount] = useState(0);
  const [totalWeeks, setTotalWeeks] = useState(14);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth/login?next=/league/${leagueId}/edit`);
      return;
    }

    async function load() {
      // Look up the Surge league row by Sleeper league_id
      const row = await getLeagueBySleeperLeagueId(supabase, leagueId);

      if (!row) {
        // No config yet — send them through the setup wizard instead
        router.replace(`/league/${leagueId}/setup`);
        return;
      }

      // Only commissioners can edit settings
      const membership = await getMember(supabase, row.id, user!.id);
      if (!membership || membership.role !== "commissioner") {
        router.replace(`/league/${leagueId}`);
        return;
      }

      // Populate form from the DB row
      setSupabaseLeagueId(row.id);
      setLeagueName(row.name);
      setSeason(row.season ?? "");
      setBuyIn(String(row.buy_in));
      setBasePenalty(row.base_penalty);
      setBottomScorersCount(row.bottom_scorers_count ?? 1);
      setTeamCount(row.team_count);
      setTotalWeeks(row.total_weeks ?? 14);

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
      await updateLeague(supabase, supabaseLeagueId, {
        buy_in: Number(buyIn),
        base_penalty: basePenalty,
        bottom_scorers_count: bottomScorersCount,
      });
      setSaved(true);
      // Bust the Next.js router cache so the dashboard re-fetches config
      // immediately when we navigate back — no manual reload needed.
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Loading / auth wait ──────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/6 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const buyInNum = Number(buyIn);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-12">
      <div className="w-full max-w-2xl mx-auto px-4 pt-5 pb-2 flex items-center gap-3">
        <button
          onClick={() => router.push(`/league/${leagueId}`)}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">
              {leagueName}
            </p>
            <span className="flex-shrink-0 text-[10px] font-bold tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-md px-2 py-0.5">
              Commissioner
            </span>
          </div>
          <p className="text-xs text-slate-600">
            League settings{season ? ` · ${season} season` : ""}
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

        {/* Buy-in */}
        <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6 space-y-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            League financials
          </p>
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
