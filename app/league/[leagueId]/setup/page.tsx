"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getLeague } from "@/lib/sleeper";
import { getSleeperSettings } from "@/lib/storage";
import { getLeagueConfig, upsertLeagueConfig } from "@/lib/supabase";
import type { MilestoneRule } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  TrendingDown,
  Activity,
  AlertCircle,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────

const inputCls =
  "bg-navy-900 border border-navy-700 focus:border-teal-500/40 " +
  "rounded-lg px-3.5 py-2.5 text-sm " +
  "text-slate-100 placeholder:text-slate-600 outline-none transition-colors w-full";

const labelCls = "block text-sm text-slate-400 mb-2";

const primaryBtnCls =
  "w-full flex items-center justify-center gap-2 " +
  "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "text-black font-semibold rounded-lg py-3 text-sm transition-colors";

// ─── Step dots ─────────────────────────────────────────────────────────────

function StepDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              i + 1 <= step ? "bg-teal-400" : "bg-slate-600"
            }`}
          />
          {i < total - 1 && (
            <div
              className={`w-4 h-px transition-colors duration-200 ${
                i + 1 < step ? "bg-teal-400/50" : "bg-navy-600"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── MilestoneDraft ────────────────────────────────────────────────────────

interface MilestoneDraft {
  enabled: boolean;
  threshold: number;
  taxAmount: number;
  exemptIfMultipleQualify: boolean;
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
    <div className={`bg-navy-800 border rounded-xl overflow-hidden transition-colors duration-200 ${value.enabled ? "border-teal-500/30" : "border-navy-700"}`}>
      <div className="flex items-start justify-between px-5 py-4 gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{description}</p>
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
                If 2+ teams hit this milestone, they&apos;re both exempt from paying — everyone else still pays into the pot
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Review row ────────────────────────────────────────────────────────────

function RuleRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-slate-300">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
      <p className="text-sm font-medium text-slate-100 tabular-nums">{value}</p>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function SleeperLeagueSetup() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [leagueName, setLeagueName] = useState("");
  const [teamCount, setTeamCount] = useState(0);
  const [season, setSeason] = useState("2025");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Step 1
  const [buyIn, setBuyIn] = useState("");

  // Step 2
  const [basePenalty, setBasePenalty] = useState(25);
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
    // Load league metadata from Sleeper
    getLeague(leagueId)
      .then((l) => {
        setLeagueName(l.name);
        setTeamCount(l.total_rosters);
        setSeason(l.season);
      })
      .finally(() => setLoadingMeta(false));

    // Pre-fill from Supabase config if it exists, else localStorage
    getLeagueConfig(leagueId)
      .then((config) => {
        if (config) {
          setBuyIn(String(config.buy_in));
          setBasePenalty(config.base_penalty);
          const ptRule = config.milestones.find((m) => m.type === "points");
          const tdRule = config.milestones.find((m) => m.type === "touchdowns");
          if (ptRule) {
            setPointsMilestone({
              enabled: true,
              threshold: ptRule.threshold,
              taxAmount: ptRule.taxPerNonQualifier,
              exemptIfMultipleQualify: ptRule.exemptIfMultipleQualify,
            });
          }
          if (tdRule) {
            setTdMilestone({
              enabled: true,
              threshold: tdRule.threshold,
              taxAmount: tdRule.taxPerNonQualifier,
              exemptIfMultipleQualify: tdRule.exemptIfMultipleQualify,
            });
          }
        } else {
          // Fall back to legacy localStorage
          const local = getSleeperSettings(leagueId);
          if (local) setBuyIn(String(local.buyIn));
        }
      })
      .catch(() => {
        const local = getSleeperSettings(leagueId);
        if (local) setBuyIn(String(local.buyIn));
      });
  }, [leagueId]);

  const buyInNum = Number(buyIn);
  const startingPot = buyInNum > 0 && teamCount > 0 ? buyInNum * teamCount : 0;

  async function launch() {
    setSaving(true);
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
      await upsertLeagueConfig({
        league_id: leagueId,
        season,
        buy_in: buyInNum,
        team_count: teamCount,
        base_penalty: basePenalty,
        milestones,
      });
      router.push(`/league/${leagueId}`);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save config."
      );
      setSaving(false);
    }
  }

  const stepLabels = ["League details", "Milestones", "Review"];

  if (loadingMeta) {
    return (
      <main
        className="bg-navy-950 flex items-center justify-center px-4"
        style={{ minHeight: "calc(100vh - 56px)" }}
      >
        <div className="w-6 h-6 border-2 border-navy-700 border-t-emerald-500 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main
      className="bg-navy-950 flex flex-col items-center px-4 pb-12 pt-[15vh]"
      style={{ minHeight: "calc(100vh - 56px)" }}
    >
      <div className="w-full max-w-[520px] sm:max-w-[620px] lg:max-w-[720px] bg-navy-900 border border-navy-700 rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-3 px-8 pt-7 pb-5 lg:px-10 lg:pt-9 lg:pb-7 border-b border-navy-700">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={() => router.back()}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm lg:text-base font-semibold text-slate-100">
              {stepLabels[step - 1]}
            </p>
            <p className="text-xs lg:text-sm text-slate-600 truncate">
              {leagueName}
            </p>
          </div>
          <StepDots step={step} />
        </div>

        {/* Content */}
        <div className="px-8 py-7 lg:px-10 lg:py-9">

          {/* ── Step 1: Buy-in ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="bg-navy-800 border border-navy-700 rounded-xl px-4 py-3.5 flex items-center justify-between">
                <span className="text-sm text-slate-400">Teams in league</span>
                <span className="text-sm font-semibold text-slate-100 tabular-nums">
                  {teamCount}
                </span>
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
                    placeholder="e.g. 200"
                    className={`${inputCls} pl-7`}
                    min={0}
                    autoFocus
                  />
                </div>
                {startingPot > 0 && (
                  <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
                    Total starting pot:{" "}
                    <span className="text-emerald-400 font-semibold">
                      ${startingPot.toLocaleString()}
                    </span>
                    <span className="text-slate-600">
                      {" "}({teamCount} teams × ${buyInNum})
                    </span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => { if (buyInNum > 0) setStep(2); }}
                disabled={buyInNum <= 0}
                className={primaryBtnCls}
              >
                Continue
                <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}

          {/* ── Step 2: Milestones ── */}
          {step === 2 && (
            <div className="space-y-5">

              {/* Lowest scorer — always active */}
              <div className="bg-navy-800 border border-navy-700 rounded-xl px-5 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <TrendingDown
                      className="w-4 h-4 text-slate-500"
                      strokeWidth={1.5}
                    />
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

              <p className="text-xs text-slate-700 text-center leading-relaxed">
                If no team clears a threshold, that milestone collects no tax for the week.
              </p>

              <button
                type="button"
                onClick={() => setStep(3)}
                className={primaryBtnCls}
              >
                Review settings
                <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div className="space-y-5">

              {saveError && (
                <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-lg px-4 py-3">
                  <AlertCircle
                    className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
                    strokeWidth={1.5}
                  />
                  <p className="text-red-400 text-sm">{saveError}</p>
                </div>
              )}

              <div className="bg-navy-800 border border-navy-700 rounded-xl divide-y divide-navy-700">
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-600 mb-1">League</p>
                  <p className="text-sm font-semibold text-slate-100">
                    {leagueName}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {teamCount} teams · {season} season
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-600 mb-1">Buy-in per team</p>
                  <p className="text-sm font-semibold text-slate-100 tabular-nums">
                    ${buyInNum.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                    ${startingPot.toLocaleString()} total starting pot
                  </p>
                </div>
              </div>

              <div className="bg-navy-800 border border-navy-700 rounded-xl px-5">
                <p className="text-xs text-slate-600 pt-4 mb-1">Rules</p>
                <div className="divide-y divide-navy-700">
                  <RuleRow
                    label="Lowest scorer"
                    value={`$${basePenalty} / week`}
                    sub="Always active"
                  />
                  {pointsMilestone.enabled ? (
                    <RuleRow
                      label={`${pointsMilestone.threshold}+ pts threshold`}
                      value={`$${pointsMilestone.taxAmount} / team`}
                      sub={
                        pointsMilestone.exemptIfMultipleQualify
                          ? "Exemption on"
                          : "No exemption"
                      }
                    />
                  ) : (
                    <RuleRow label="Points threshold" value="Off" />
                  )}
                  {tdMilestone.enabled ? (
                    <RuleRow
                      label={`${tdMilestone.threshold}+ TD threshold`}
                      value={`$${tdMilestone.taxAmount} / team`}
                      sub={
                        tdMilestone.exemptIfMultipleQualify
                          ? "Exemption on"
                          : "No exemption"
                      }
                    />
                  ) : (
                    <RuleRow label="TD threshold" value="Off" />
                  )}
                </div>
                <div className="pb-4" />
              </div>

              <button
                type="button"
                onClick={launch}
                disabled={saving}
                className={primaryBtnCls}
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" strokeWidth={1.5} />
                    Launch league
                  </>
                )}
              </button>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
