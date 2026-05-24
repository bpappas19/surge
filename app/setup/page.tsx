"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveLeague } from "@/lib/storage";
import type { ManualLeague, MilestoneRule } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  TrendingDown,
  Activity,
  AlertCircle,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────

/** Subtle input — focus shifts border slightly, no ring flash */
const inputCls =
  "bg-navy-900 border border-navy-700 focus:border-teal-500/40 " +
  "rounded-lg px-3.5 py-2.5 text-sm " +
  "text-slate-100 placeholder:text-slate-600 outline-none transition-colors w-full";

/** Sentence-case field label */
const labelCls = "block text-sm text-slate-400 mb-2";

/** Primary action — dark emerald, white text */
const primaryBtnCls =
  "w-full flex items-center justify-center gap-2 " +
  "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 " +
  "text-white font-semibold rounded-lg py-3 text-sm transition-colors";

// ─── Step indicator — minimal dots ────────────────────────────────────────────

function StepDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={`rounded-full transition-all duration-200 ${
              i + 1 <= step
                ? "w-2.5 h-2.5 bg-teal-400"
                : "w-1.5 h-1.5 bg-slate-600"
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

// ─── Milestone toggle card ────────────────────────────────────────────────────

interface MilestoneDraft {
  enabled: boolean;
  threshold: number;
  taxAmount: number;
  exemptIfMultipleQualify: boolean;
}

function MilestoneCard({
  title,
  unit,
  value,
  onChange,
}: {
  title: string;
  unit: string;
  value: MilestoneDraft;
  onChange: (v: MilestoneDraft) => void;
}) {
  return (
    <div className={`bg-navy-800 border rounded-xl overflow-hidden transition-colors duration-200 ${value.enabled ? "border-teal-500/30" : "border-navy-700"}`}>
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <button
          type="button"
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
          className={`relative w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
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
                  onChange={(e) => onChange({ ...value, threshold: Number(e.target.value) })}
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
                  onChange={(e) => onChange({ ...value, taxAmount: Number(e.target.value) })}
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
              onChange({ ...value, exemptIfMultipleQualify: !value.exemptIfMultipleQualify })
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

// ─── Review row ───────────────────────────────────────────────────────────────

function RuleRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep]   = useState(1);
  const [errors, setErrors] = useState<string[]>([]);

  const [leagueName, setLeagueName] = useState("");
  const [buyIn, setBuyIn]           = useState("");
  const [teams, setTeams]           = useState(["", "", ""]);

  const [basePenalty, setBasePenalty] = useState(25);
  const [pointsMilestone, setPointsMilestone] = useState<MilestoneDraft>({
    enabled: false, threshold: 130, taxAmount: 10, exemptIfMultipleQualify: true,
  });
  const [tdMilestone, setTdMilestone] = useState<MilestoneDraft>({
    enabled: false, threshold: 3, taxAmount: 10, exemptIfMultipleQualify: true,
  });

  const validTeams = teams.map((n) => n.trim()).filter(Boolean);

  function addTeam() { if (teams.length < 14) setTeams([...teams, ""]); }
  function updateTeam(i: number, val: string) {
    const next = [...teams]; next[i] = val; setTeams(next);
  }
  function removeTeam(i: number) {
    if (teams.length <= 2) return;
    setTeams(teams.filter((_, idx) => idx !== i));
  }

  function goStep2() {
    const errs: string[] = [];
    if (!leagueName.trim()) errs.push("League name is required.");
    if (!buyIn || Number(buyIn) <= 0) errs.push("Buy-in per team is required.");
    if (validTeams.length < 2) errs.push("At least 2 team names are required.");
    setErrors(errs);
    if (errs.length === 0) setStep(2);
  }

  function launch() {
    const milestones: MilestoneRule[] = [];
    if (pointsMilestone.enabled) milestones.push({
      type: "points", threshold: pointsMilestone.threshold,
      taxPerNonQualifier: pointsMilestone.taxAmount,
      exemptIfMultipleQualify: pointsMilestone.exemptIfMultipleQualify,
    });
    if (tdMilestone.enabled) milestones.push({
      type: "touchdowns", threshold: tdMilestone.threshold,
      taxPerNonQualifier: tdMilestone.taxAmount,
      exemptIfMultipleQualify: tdMilestone.exemptIfMultipleQualify,
    });
    const league: ManualLeague = {
      id: crypto.randomUUID(),
      name: leagueName.trim(),
      teams: validTeams.map((name) => ({ id: crypto.randomUUID(), name })),
      config: { basePenalty, milestones, buyIn: Number(buyIn) },
      createdAt: new Date().toISOString(),
    };
    saveLeague(league);
    router.push(`/m/${league.id}`);
  }

  const stepLabels = ["League details", "Milestones", "Review"];

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
              onClick={() => { setErrors([]); setStep(step - 1); }}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
          ) : (
            <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0">
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </Link>
          )}
          <div className="flex-1">
            <p className="text-sm lg:text-base font-semibold text-slate-100">{stepLabels[step - 1]}</p>
            <p className="text-xs lg:text-sm text-slate-600">Step {step} of 3</p>
          </div>
          <StepDots step={step} />
        </div>

        {/* Content */}
        <div className="px-8 py-7 lg:px-10 lg:py-9">

        {/* ── Step 1: League details ── */}
        {step === 1 && (
          <div className="space-y-8">
            {errors.length > 0 && (
              <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="space-y-1">
                  {errors.map((e) => (
                    <p key={e} className="text-red-400 text-sm">{e}</p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>League name</label>
              <input
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="e.g. The Factory"
                className={inputCls}
                autoFocus
              />
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
                />
              </div>
              {Number(buyIn) > 0 && teams.length > 0 && (
                <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
                  Total starting pot:{" "}
                  <span className="text-emerald-400 font-semibold">
                    ${(Number(buyIn) * teams.length).toLocaleString()}
                  </span>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className={`${labelCls} mb-0`}>Teams</label>
                <span className="text-xs text-slate-600 tabular-nums">
                  {teams.length} / 14
                </span>
              </div>

              <div className="space-y-2">
                {teams.map((name, i) => (
                  <div key={i} className="flex items-center gap-2.5 border-l-2 border-teal-500/25 pl-2">
                    <span className="text-xs text-slate-700 tabular-nums w-4 text-right flex-shrink-0 select-none">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateTeam(i, e.target.value)}
                      placeholder={`Team ${i + 1}`}
                      className={inputCls}
                    />
                    {teams.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeTeam(i)}
                        className="text-slate-700 hover:text-slate-400 transition-colors flex-shrink-0 p-1"
                        aria-label="Remove team"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {teams.length < 14 && (
                <button
                  type="button"
                  onClick={addTeam}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 border border-navy-700 hover:border-navy-600 rounded-lg px-3 py-1.5 transition-colors mt-3"
                >
                  <Plus className="w-3 h-3" strokeWidth={1.5} />
                  Add team
                </button>
              )}
            </div>

            <button type="button" onClick={goStep2} className={primaryBtnCls}>
              Continue
              <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* ── Step 2: Milestones ── */}
        {step === 2 && (
          <div className="space-y-5">

            {/* Base rule */}
            <div className="bg-navy-800 border border-navy-700 rounded-xl px-5 py-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <TrendingDown className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-slate-200">Lowest scorer penalty</p>
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
                    onChange={(e) => setBasePenalty(Math.max(0, Number(e.target.value)))}
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
              value={pointsMilestone}
              onChange={setPointsMilestone}
            />

            <MilestoneCard
              title="Touchdown threshold"
              unit="TDs"
              value={tdMilestone}
              onChange={setTdMilestone}
            />

            <p className="text-xs text-slate-700 text-center leading-relaxed">
              If no team clears a threshold, that milestone collects no tax for the week.
            </p>

            <button type="button" onClick={() => setStep(3)} className={primaryBtnCls}>
              Review league
              <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <div className="space-y-5">

            <div className="bg-navy-800 border border-navy-700 rounded-xl divide-y divide-navy-700">
              <div className="px-5 py-4">
                <p className="text-xs text-slate-600 mb-1">League</p>
                <p className="text-sm font-semibold text-slate-100">{leagueName}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-slate-600 mb-2">Teams</p>
                <p className="text-sm font-semibold text-slate-100 tabular-nums mb-2">
                  {validTeams.length} teams
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {validTeams.map((name) => (
                    <span
                      key={name}
                      className="text-xs text-slate-400 bg-navy-700 rounded px-2 py-0.5"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-slate-600 mb-1">Buy-in per team</p>
                <p className="text-sm font-semibold text-slate-100 tabular-nums">
                  ${Number(buyIn).toLocaleString()}
                </p>
                <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                  ${(Number(buyIn) * validTeams.length).toLocaleString()} total starting pot
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
                    label={`Points below ${pointsMilestone.threshold}`}
                    value={`$${pointsMilestone.taxAmount} / team`}
                    sub={pointsMilestone.exemptIfMultipleQualify ? "Exemption on" : "No exemption"}
                  />
                ) : (
                  <RuleRow label="Points threshold" value="Off" />
                )}
                {tdMilestone.enabled ? (
                  <RuleRow
                    label={`TDs below ${tdMilestone.threshold}`}
                    value={`$${tdMilestone.taxAmount} / team`}
                    sub={tdMilestone.exemptIfMultipleQualify ? "Exemption on" : "No exemption"}
                  />
                ) : (
                  <RuleRow label="TD threshold" value="Off" />
                )}
              </div>
              <div className="pb-4" />
            </div>

            <button type="button" onClick={launch} className={primaryBtnCls}>
              <Activity className="w-4 h-4" strokeWidth={1.5} />
              Launch league
            </button>

            <p className="text-xs text-slate-700 text-center">
              League data is saved locally to this device.
            </p>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}
