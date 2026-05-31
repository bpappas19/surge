"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLeagueById,
  getMember,
  updateLeague,
} from "@/lib/db";
import type { MilestoneRule } from "@/lib/types";
import {
  ChevronLeft,
  Check,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────

const inputCls =
  "bg-navy-900 border border-navy-700 focus:border-teal-500/40 " +
  "rounded-lg px-3.5 py-2.5 text-sm " +
  "text-slate-100 placeholder:text-slate-600 outline-none transition-colors w-full";

const labelCls = "block text-sm text-slate-400 mb-2";

const primaryBtnCls =
  "w-full flex items-center justify-center gap-2 " +
  "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "text-white font-semibold rounded-lg py-3 text-sm transition-colors";

// ─── MilestoneDraft ─────────────────────────────────────────────────────────

interface MilestoneDraft {
  enabled: boolean;
  threshold: number;
  taxAmount: number;
  exemptIfMultipleQualify: boolean;
}

function draftFromRule(rule: MilestoneRule): MilestoneDraft {
  return {
    enabled: true,
    threshold: rule.threshold,
    taxAmount: rule.taxPerNonQualifier,
    exemptIfMultipleQualify: rule.exemptIfMultipleQualify,
  };
}

// ─── MilestoneCard ─────────────────────────────────────────────────────────

function MilestoneCard({
  title,
  unit,
  description,
  value,
  onChange,
}: {
  title: string;
  unit: string;
  description: string;
  value: MilestoneDraft;
  onChange: (v: MilestoneDraft) => void;
}) {
  return (
    <div
      className={`bg-navy-800 border rounded-xl overflow-hidden transition-colors duration-200 ${
        value.enabled ? "border-teal-500/30" : "border-navy-700"
      }`}
    >
      <div className="flex items-start justify-between px-5 py-4 gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
          className={`relative w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0 mt-0.5 ${
            value.enabled ? "bg-emerald-500" : "bg-navy-600"
          }`}
          aria-checked={value.enabled}
          role="switch"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              value.enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {value.enabled && (
        <div className="border-t border-navy-700 px-5 pt-5 pb-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Threshold</label>
              <div className="relative">
                <input
                  type="number"
                  value={value.threshold === 0 ? "" : value.threshold}
                  onChange={(e) =>
                    onChange({ ...value, threshold: Number(e.target.value) })
                  }
                  onFocus={(e) => e.target.select()}
                  className={inputCls}
                  min={0}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none">
                  {unit}
                </span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Tax per team</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  value={value.taxAmount === 0 ? "" : value.taxAmount}
                  onChange={(e) =>
                    onChange({ ...value, taxAmount: Number(e.target.value) })
                  }
                  onFocus={(e) => e.target.select()}
                  className={`${inputCls} pl-6`}
                  min={0}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                exemptIfMultipleQualify: !value.exemptIfMultipleQualify,
              })
            }
            className="flex items-start gap-3 text-left w-full group"
          >
            <div
              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                value.exemptIfMultipleQualify
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-navy-600 group-hover:border-navy-500"
              }`}
            >
              {value.exemptIfMultipleQualify && (
                <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />
              )}
            </div>
            <div>
              <p className="text-sm text-slate-300 leading-snug">
                Multiple teams can win the same milestone
              </p>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                If 2+ teams hit this milestone, they&apos;re both exempt from
                paying — everyone else still pays into the pot
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

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

  // Form state
  const [season, setSeason] = useState(String(currentYear));
  const [buyIn, setBuyIn] = useState("");
  const [basePenalty, setBasePenalty] = useState(25);
  const [totalWeeks, setTotalWeeks] = useState(14);
  const [pointsMilestone, setPointsMilestone] = useState<MilestoneDraft>({
    enabled: false,
    threshold: 130,
    taxAmount: 10,
    exemptIfMultipleQualify: true,
  });
  const [tdMilestone, setTdMilestone] = useState<MilestoneDraft>({
    enabled: false,
    threshold: 3,
    taxAmount: 10,
    exemptIfMultipleQualify: true,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth/login?next=/m/${leagueId}/settings`);
      return;
    }

    async function load() {
      const [row, membership] = await Promise.all([
        getLeagueById(supabase, leagueId),
        getMember(supabase, leagueId, user!.id),
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
      setSeason(row.season ?? String(currentYear));
      setBuyIn(String(row.buy_in));
      setBasePenalty(row.base_penalty);
      setTotalWeeks(row.total_weeks ?? 14);

      const milestones = (row.milestones ?? []) as MilestoneRule[];
      const ptRule = milestones.find((m) => m.type === "points");
      const tdRule = milestones.find((m) => m.type === "touchdowns");

      if (ptRule) setPointsMilestone(draftFromRule(ptRule));
      if (tdRule) setTdMilestone(draftFromRule(tdRule));

      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, leagueId]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError("");

    const milestones: MilestoneRule[] = [];
    if (pointsMilestone.enabled) {
      milestones.push({
        type: "points",
        threshold: pointsMilestone.threshold,
        taxPerNonQualifier: pointsMilestone.taxAmount,
        exemptIfMultipleQualify: pointsMilestone.exemptIfMultipleQualify,
      });
    }
    if (tdMilestone.enabled) {
      milestones.push({
        type: "touchdowns",
        threshold: tdMilestone.threshold,
        taxPerNonQualifier: tdMilestone.taxAmount,
        exemptIfMultipleQualify: tdMilestone.exemptIfMultipleQualify,
      });
    }

    try {
      await updateLeague(supabase, leagueId, {
        season,
        buy_in: Number(buyIn),
        base_penalty: basePenalty,
        total_weeks: totalWeeks,
        milestones,
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

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-navy-700 border-t-emerald-500 rounded-full animate-spin" />
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
            <p className="text-sm font-semibold text-slate-100 truncate">
              {leagueName}
            </p>
            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded px-1.5 py-0.5">
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

        {/* Season year + buy-in */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl px-5 py-5 space-y-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
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
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                    season === String(yr)
                      ? "bg-navy-700 border-emerald-500/60 text-white shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                      : "bg-navy-900 border-navy-600 text-slate-400 hover:text-slate-200 hover:border-navy-500"
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
                className="w-9 h-9 rounded-lg bg-navy-900 border border-navy-700 text-slate-300 hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium select-none"
              >
                −
              </button>
              <span className="text-sm font-semibold text-slate-100 tabular-nums w-8 text-center">{totalWeeks}</span>
              <button
                type="button"
                onClick={() => setTotalWeeks((w) => Math.min(18, w + 1))}
                disabled={totalWeeks >= 18}
                className="w-9 h-9 rounded-lg bg-navy-900 border border-navy-700 text-slate-300 hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium select-none"
              >
                +
              </button>
              <span className="text-xs text-slate-600">weeks</span>
            </div>
          </div>
        </div>

        {/* Base penalty */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <TrendingDown className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
              <p className="text-sm font-medium text-slate-200">
                Lowest scorer penalty
              </p>
            </div>
            <span className="text-xs text-slate-600">Always active</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Owes</span>
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

        {/* Milestone cards */}
        <MilestoneCard
          title="Points threshold"
          unit="pts"
          description="If a team scores X+ points, everyone else pays"
          value={pointsMilestone}
          onChange={setPointsMilestone}
        />

        <MilestoneCard
          title="Touchdown threshold"
          unit="TDs"
          description="If a team has a player with X+ TDs, everyone else pays"
          value={tdMilestone}
          onChange={setTdMilestone}
        />

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
