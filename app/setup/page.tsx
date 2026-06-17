"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase-browser";
import { createLeague, addMember, addManualTeams, claimManualTeam } from "@/lib/db";
import { StripeConnectCard } from "@/components/StripeConnectCard";
import { BottomScorersSelector, PotGrowthPreview } from "@/components/PotRules";
import {
  ChevronLeft, ChevronRight, ChevronDown, X,
  TrendingDown, Activity, AlertCircle,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────

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
  "text-white font-medium rounded-xl py-2.5 text-sm transition-colors";

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={`rounded-full transition-all duration-200 ${
              i + 1 <= step ? "w-2.5 h-2.5 bg-emerald-400" : "w-1.5 h-1.5 bg-slate-600"
            }`}
          />
          {i < total - 1 && (
            <div
              className={`w-4 h-px transition-colors duration-200 ${
                i + 1 < step ? "bg-emerald-400/50" : "bg-white/10"
              }`}
            />
          )}
        </div>
      ))}
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
      <p className="text-sm font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy}
      className="text-xs font-medium flex-shrink-0 border border-white/8 hover:border-white/20 text-slate-400 hover:text-slate-200 rounded-lg px-3 py-2 transition-colors">
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router  = useRouter();
  const { user } = useAuth();

  const [step,   setStep]   = useState(1);
  const [errors, setErrors] = useState<string[]>([]);

  // Step 1
  const currentYear = new Date().getFullYear();
  const [leagueName, setLeagueName] = useState("");
  const [season,     setSeason]     = useState(String(currentYear));
  const [buyIn,      setBuyIn]      = useState("");
  const [teams,      setTeams]      = useState(["", "", ""]);

  // Step 2
  const [basePenalty,       setBasePenalty]       = useState(25);
  const [bottomScorersCount, setBottomScorersCount] = useState(1);
  const [totalWeeks,        setTotalWeeks]        = useState(14);

  // Launch state
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState("");
  const [launchedLeagueId, setLaunchedLeagueId] = useState<string | null>(null);
  const [inviteUrl,       setInviteUrl]       = useState("");

  // Pre-fill the first team slot with the commissioner's own name —
  // they're auto-assigned that team at launch, editable here if it's wrong.
  useEffect(() => {
    const displayName = user?.user_metadata?.display_name as string | undefined;
    if (!displayName) return;
    setTeams((prev) => (prev[0] ? prev : [displayName, ...prev.slice(1)]));
  }, [user]);

  const validTeams = teams.map((n) => n.trim()).filter(Boolean);

  function setTeamCount(n: number) {
    const count = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, n));
    setTeams((prev) =>
      count > prev.length
        ? [...prev, ...Array(count - prev.length).fill("")]
        : prev.slice(0, count)
    );
  }
  function updateTeam(i: number, v: string) { const n = [...teams]; n[i] = v; setTeams(n); }
  function removeTeam(i: number)        { if (teams.length > MIN_TEAMS) setTeams(teams.filter((_, idx) => idx !== i)); }

  function goStep2() {
    const errs: string[] = [];
    if (!leagueName.trim()) errs.push("League name is required.");
    if (!buyIn || Number(buyIn) <= 0) errs.push("Buy-in per team is required.");
    if (validTeams.length < 2) errs.push("At least 2 team names are required.");
    setErrors(errs);
    if (!errs.length) setStep(2);
  }

  async function launch() {
    if (!user) { router.push("/auth/login?next=/setup"); return; }
    setSaving(true);
    setSaveError("");

    try {
      const supabase = createClient();
      const leagueRow = await createLeague(supabase, {
        name:          leagueName.trim(),
        season,
        buyIn:         Number(buyIn),
        teamCount:     validTeams.length,
        basePenalty,
        bottomScorersCount,
        mode:          "manual",
        commissionerId: user.id,
        totalWeeks,
      });

      // Add commissioner as first member
      const commName = (user.user_metadata?.display_name as string | undefined) ?? "Commissioner";
      await addMember(supabase, leagueRow.id, user.id, "commissioner", commName);

      // Save the team list so the dashboard is fully populated immediately —
      // members claim their team later via the invite link.
      const manualTeams = await addManualTeams(supabase, leagueRow.id, validTeams);

      // Auto-assign the commissioner to the first team (their own).
      if (manualTeams[0]) {
        await claimManualTeam(supabase, manualTeams[0].id, user.id);
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
      setLaunchedLeagueId(leagueRow.id);
      setInviteUrl(`${appUrl}/join/${leagueRow.id}`);
      setStep(4);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to launch league.");
    } finally {
      setSaving(false);
    }
  }

  const stepLabels = ["League details", "Pot rules", "Review", "Invite & payments"];

  return (
    <main className="bg-navy-950 flex flex-col items-center px-4 pb-12 pt-[15vh]"
      style={{ minHeight: "calc(100vh - 64px)" }}>

      <div className="w-full max-w-[520px] sm:max-w-[620px] lg:max-w-[720px] bg-[#0d1420] border border-white/6 rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-3 px-8 pt-7 pb-5 lg:px-10 lg:pt-9 lg:pb-7 border-b border-white/6">
          {step > 1 && step < 4 ? (
            <button onClick={() => { setErrors([]); setStep(step - 1); }}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0">
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
          ) : step === 1 ? (
            <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0">
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </Link>
          ) : (
            <div className="w-7 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm lg:text-base font-semibold text-white">{stepLabels[step - 1]}</p>
            <p className="text-xs lg:text-sm text-slate-600">Step {step} of 4</p>
          </div>
          <StepDots step={step} total={4} />
        </div>

        {/* Content */}
        <div className="px-8 py-7 lg:px-10 lg:py-9">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-8">
              {errors.length > 0 && (
                <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="space-y-1">{errors.map((e) => <p key={e} className="text-red-400 text-sm">{e}</p>)}</div>
                </div>
              )}

              <div>
                <label className={labelCls}>League name</label>
                <input type="text" value={leagueName} onChange={(e) => setLeagueName(e.target.value)}
                  placeholder="e.g. The Factory" className={inputCls} autoFocus />
              </div>

              <div>
                <label className={labelCls}>Season year</label>
                <div className="relative">
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className={`${inputCls} pr-9 appearance-none cursor-pointer`}
                  >
                    {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                      <option key={yr} value={String(yr)}>
                        {yr}{yr === currentYear ? " (current)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none"
                    strokeWidth={1.5}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Buy-in per team</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none">$</span>
                  <input type="number" value={buyIn} onChange={(e) => setBuyIn(e.target.value)}
                    placeholder="e.g. 200" className={`${inputCls} pl-7`} min={0} />
                </div>
                {Number(buyIn) > 0 && teams.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
                    Total starting pot:{" "}
                    <span className="text-emerald-400 font-semibold">${(Number(buyIn) * teams.length).toLocaleString()}</span>
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Teams</label>
                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setTeamCount(teams.length - 1)}
                    disabled={teams.length <= MIN_TEAMS}
                    className="w-9 h-9 rounded-xl bg-[#0d1420] border border-white/6 hover:border-white/20 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium select-none"
                  >
                    −
                  </button>
                  <span className="text-sm font-semibold text-white tabular-nums w-8 text-center">{teams.length}</span>
                  <button
                    type="button"
                    onClick={() => setTeamCount(teams.length + 1)}
                    disabled={teams.length >= MAX_TEAMS}
                    className="w-9 h-9 rounded-xl bg-[#0d1420] border border-white/6 hover:border-white/20 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium select-none"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-600">teams</span>
                </div>
                <div className="space-y-2">
                  {teams.map((name, i) => (
                    <div key={i} className="flex items-center gap-2.5 border-l-2 border-emerald-500/25 pl-2">
                      <span className="text-xs text-slate-700 tabular-nums w-4 text-right flex-shrink-0 select-none">{i + 1}</span>
                      <input type="text" value={name} onChange={(e) => updateTeam(i, e.target.value)}
                        placeholder={`Team ${i + 1}`} className={inputCls} />
                      {teams.length > MIN_TEAMS && (
                        <button type="button" onClick={() => removeTeam(i)}
                          className="text-slate-700 hover:text-slate-400 transition-colors flex-shrink-0 p-1" aria-label="Remove team">
                          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="button" onClick={goStep2} className={primaryBtnCls}>
                Continue <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <TrendingDown className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
                    <p className="text-sm font-semibold text-white">Bottom scorer penalty</p>
                  </div>
                  <span className="text-xs text-slate-600">Always active</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">Each owes</span>
                  <div className="relative w-24">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none">$</span>
                    <input type="number" value={basePenalty === 0 ? "" : basePenalty}
                      onChange={(e) => setBasePenalty(Math.max(0, Number(e.target.value)))}
                      onFocus={(e) => e.target.select()} className={`${inputCls} pl-7 tabular-nums`} min={0} />
                  </div>
                  <span className="text-sm text-slate-500">per week</span>
                </div>
              </div>

              <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6">
                <p className="text-sm font-semibold text-white mb-1">How many teams pay each week?</p>
                <p className="text-xs text-slate-600 mb-4">The lowest-scoring teams each week pay into the pot.</p>
                <BottomScorersSelector value={bottomScorersCount} onChange={setBottomScorersCount} teamCount={validTeams.length} />
              </div>

              <PotGrowthPreview bottomScorersCount={bottomScorersCount} basePenalty={basePenalty} totalWeeks={totalWeeks} />

              <button type="button" onClick={() => setStep(3)} className={primaryBtnCls}>
                Review league <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="bg-[#0d1420] border border-white/6 rounded-2xl divide-y divide-white/6">
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-600 mb-1">League</p>
                  <p className="text-sm font-semibold text-white">{leagueName}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{season} season</p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-600 mb-2">Teams</p>
                  <p className="text-sm font-bold text-white tabular-nums mb-2">{validTeams.length} teams</p>
                  <div className="flex flex-wrap gap-1.5">
                    {validTeams.map((name) => (
                      <span key={name} className="text-xs text-slate-400 bg-white/5 border border-white/6 rounded-md px-2 py-0.5">{name}</span>
                    ))}
                  </div>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-600 mb-1">Buy-in per team</p>
                  <p className="text-sm font-bold text-white tabular-nums">${Number(buyIn).toLocaleString()}</p>
                  <p className="text-xs text-slate-600 mt-0.5 tabular-nums">${(Number(buyIn) * validTeams.length).toLocaleString()} total starting pot</p>
                </div>
              </div>

              <div className="bg-[#0d1420] border border-white/6 rounded-2xl px-5">
                <p className="text-xs text-slate-600 pt-4 mb-1">Rules</p>
                <div className="divide-y divide-white/6">
                  <RuleRow
                    label={`Bottom ${bottomScorersCount} scorer${bottomScorersCount > 1 ? "s" : ""}`}
                    value={`$${basePenalty.toLocaleString()} / week each`}
                    sub="Always active"
                  />
                </div>
                <div className="pb-4" />
              </div>

              <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6">
                <p className="text-xs text-slate-600 mb-3">Regular season length</p>
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
                  <span className="text-xs text-slate-600">weeks · most leagues play 14</span>
                </div>
              </div>

              {saveError && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-red-400 text-sm">{saveError}</p>
                </div>
              )}

              <button type="button" onClick={launch} disabled={saving} className={primaryBtnCls}>
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Launching…</>
                ) : (
                  <><Activity className="w-4 h-4" strokeWidth={1.5} /> Launch league</>
                )}
              </button>
              <p className="text-xs text-slate-700 text-center">League data is saved to your account.</p>
            </div>
          )}

          {/* ── Step 4: Invite & Payments ── */}
          {step === 4 && launchedLeagueId && (
            <div className="space-y-5">
              {/* Success */}
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <Activity className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-white">League launched!</p>
                <p className="text-xs text-slate-600 mt-1">{leagueName} is live</p>
              </div>

              {/* Invite link */}
              <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6 space-y-3">
                <p className="text-xs text-slate-500 uppercase tracking-widest">Invite link</p>
                <p className="text-xs text-slate-600">Share this with your league members</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
                    <p className="text-xs text-slate-400 truncate">{inviteUrl}</p>
                  </div>
                  <CopyButton text={inviteUrl} />
                </div>
              </div>

              {/* Stripe Connect */}
              <StripeConnectCard leagueId={launchedLeagueId} mode="manual" />

              {/* Go to dashboard */}
              <button type="button" onClick={() => router.push(`/m/${launchedLeagueId}`)} className={primaryBtnCls}>
                Go to dashboard <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
