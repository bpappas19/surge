"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getLeague } from "@/lib/sleeper";
import { getLeagueConfig } from "@/lib/supabase";
import { getSleeperSettings } from "@/lib/storage";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  createLeague,
  addMember,
  getLeagueBySleeperLeagueId,
} from "@/lib/db";
import { StripeConnectCard } from "@/components/StripeConnectCard";
import { BottomScorersSelector, PotGrowthPreview } from "@/components/PotRules";
import {
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
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

// ─── Step dots ─────────────────────────────────────────────────────────────

function StepDots({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={`rounded-full transition-colors duration-200 ${
              i + 1 === step
                ? "w-2.5 h-2.5 bg-emerald-400"
                : i + 1 < step
                ? "w-2 h-2 bg-emerald-400/60"
                : "w-1.5 h-1.5 bg-slate-600"
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

// ─── CopyButton ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-white/8 hover:border-white/20 rounded-lg transition-colors flex-shrink-0"
    >
      {copied ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
      ) : (
        <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
      )}
      {copied ? "Copied!" : "Copy"}
    </button>
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
      <p className="text-sm font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function SleeperLeagueSetup() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState(1);
  const [leagueName, setLeagueName] = useState("");
  const [teamCount, setTeamCount] = useState(0);
  const [season, setSeason] = useState(() => String(new Date().getFullYear()));
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Step 4 state
  const [inviteUrl, setInviteUrl] = useState("");
  const [leagueRowId, setLeagueRowId] = useState("");

  // Step 1
  const [buyIn, setBuyIn] = useState("");

  // Step 2
  const [basePenalty, setBasePenalty] = useState(25);
  const [bottomScorersCount, setBottomScorersCount] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(14); // derived from Sleeper API, not user-editable

  useEffect(() => {
    // Load Sleeper league metadata
    getLeague(leagueId)
      .then((l) => {
        setLeagueName(l.name);
        setTeamCount(l.total_rosters);
        setSeason(l.season);
        setTotalWeeks(l.settings.playoff_week_start - 1);
      })
      .finally(() => setLoadingMeta(false));

    // Pre-fill: leagues table → legacy Supabase → localStorage
    getLeagueBySleeperLeagueId(supabase, leagueId)
      .then((row) => {
        if (row) {
          setBuyIn(String(row.buy_in));
          setBasePenalty(row.base_penalty);
          setBottomScorersCount(row.bottom_scorers_count ?? 1);
          setTotalWeeks(row.total_weeks ?? 14);
          return;
        }
        // Legacy fallback
        return getLeagueConfig(leagueId)
          .then((config) => {
            if (config) {
              setBuyIn(String(config.buy_in));
              setBasePenalty(config.base_penalty);
              setBottomScorersCount(config.bottom_scorers_count ?? 1);
            } else {
              const local = getSleeperSettings(leagueId);
              if (local) setBuyIn(String(local.buyIn));
            }
          })
          .catch(() => {
            const local = getSleeperSettings(leagueId);
            if (local) setBuyIn(String(local.buyIn));
          });
      })
      .catch(() => {
        const local = getSleeperSettings(leagueId);
        if (local) setBuyIn(String(local.buyIn));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const buyInNum = Number(buyIn);
  const startingPot = buyInNum > 0 && teamCount > 0 ? buyInNum * teamCount : 0;

  async function launch() {
    if (authLoading) {
      setSaveError("Still verifying your session — please wait a moment and try again.");
      return;
    }
    if (!user) {
      router.push(`/auth/login?next=/league/${leagueId}/setup`);
      return;
    }
    setSaving(true);
    setSaveError("");

    try {
      let leagueRow = await getLeagueBySleeperLeagueId(supabase, leagueId);

      if (leagueRow) {
        // Update existing row — check error explicitly so failures surface
        const { error: updateError } = await supabase
          .from("leagues")
          .update({
            buy_in: buyInNum,
            base_penalty: basePenalty,
            bottom_scorers_count: bottomScorersCount,
            team_count: teamCount,
            total_weeks: totalWeeks,
          })
          .eq("id", leagueRow.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        // Create new league row
        leagueRow = await createLeague(supabase, {
          name: leagueName,
          season,
          buyIn: buyInNum,
          teamCount,
          basePenalty,
          bottomScorersCount,
          mode: "sleeper",
          sleeperLeagueId: leagueId,
          commissionerId: user.id,
          totalWeeks,
        });
      }

      // Ensure commissioner is a member (upsert is idempotent)
      await addMember(
        supabase,
        leagueRow.id,
        user.id,
        "commissioner",
        (user.user_metadata?.display_name as string | undefined) ?? "Commissioner"
      );

      setLeagueRowId(leagueRow.id);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
      setInviteUrl(`${appUrl}/join/${leagueRow.id}`);
      setStep(4);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save config.";
      // Surface the raw message so the commissioner can diagnose permission/RLS errors
      setSaveError(msg);
      setSaving(false);
    }
  }

  const stepLabels = ["League details", "Pot rules", "Review", "Share"];

  if (loadingMeta) {
    return (
      <main
        className="bg-navy-950 flex items-center justify-center px-4"
        style={{ minHeight: "calc(100vh - 64px)" }}
      >
        <div className="w-6 h-6 border-2 border-white/6 border-t-emerald-500 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main
      className="bg-navy-950 flex flex-col items-center px-4 pb-12 pt-[15vh]"
      style={{ minHeight: "calc(100vh - 64px)" }}
    >
      <div className="w-full max-w-[520px] sm:max-w-[620px] lg:max-w-[720px] bg-[#0d1420] border border-white/6 rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-3 px-8 pt-7 pb-5 lg:px-10 lg:pt-9 lg:pb-7 border-b border-white/6">
          {step > 1 && step < 4 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
          ) : step === 1 ? (
            <button
              onClick={() => router.back()}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
          ) : (
            <div className="w-7 flex-shrink-0" /> /* spacer on step 4 */
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm lg:text-base font-semibold text-white">
              {stepLabels[step - 1]}
            </p>
            <p className="text-xs lg:text-sm text-slate-600 truncate">
              {leagueName}{season ? ` · ${season}` : ""}
            </p>
          </div>
          <StepDots step={step} />
        </div>

        {/* Content */}
        <div className="px-8 py-7 lg:px-10 lg:py-9">

          {/* ── Step 1: Buy-in ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="bg-[#0d1420] border border-white/6 rounded-2xl px-4 py-3.5 flex items-center justify-between">
                <span className="text-sm text-slate-400">Teams in league</span>
                <span className="text-sm font-bold text-white tabular-nums">
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
                      {" "}({teamCount} teams × ${buyInNum.toLocaleString()})
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

          {/* ── Step 2: Pot rules ── */}
          {step === 2 && (
            <div className="space-y-5">

              {/* Bottom scorer penalty — always active */}
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

              <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6">
                <p className="text-sm font-semibold text-white mb-1">How many teams pay each week?</p>
                <p className="text-xs text-slate-600 mb-4">The lowest-scoring teams each week pay into the pot.</p>
                <BottomScorersSelector value={bottomScorersCount} onChange={setBottomScorersCount} teamCount={teamCount} />
              </div>

              <PotGrowthPreview bottomScorersCount={bottomScorersCount} basePenalty={basePenalty} totalWeeks={totalWeeks} />

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
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-red-400 text-sm">{saveError}</p>
                </div>
              )}

              <div className="bg-[#0d1420] border border-white/6 rounded-2xl divide-y divide-white/6">
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-600 mb-1">League</p>
                  <p className="text-sm font-semibold text-white">{leagueName}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {teamCount} teams · {season} season
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-600 mb-1">Buy-in per team</p>
                  <p className="text-sm font-bold text-white tabular-nums">
                    ${buyInNum.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                    ${startingPot.toLocaleString()} total starting pot
                  </p>
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

              <button
                type="button"
                onClick={launch}
                disabled={saving}
                className={primaryBtnCls}
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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

          {/* ── Step 4: Share ── */}
          {step === 4 && (
            <div className="space-y-5">

              {/* Success indicator */}
              <div className="flex items-center gap-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-5 py-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-semibold text-white">League configured!</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Invite your league-mates to join
                  </p>
                </div>
              </div>

              {/* Invite link */}
              {inviteUrl && (
                <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-5 sm:p-6 space-y-3">
                  <p className="text-xs text-slate-500 uppercase tracking-widest">Invite link</p>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5">
                    <p className="text-xs text-slate-400 flex-1 min-w-0 truncate font-mono">
                      {inviteUrl}
                    </p>
                    <CopyButton text={inviteUrl} />
                  </div>
                  <p className="text-xs text-slate-700">
                    Anyone with this link can join and add their payment method.
                  </p>
                </div>
              )}

              {/* Stripe Connect */}
              {leagueRowId && (
                <StripeConnectCard
                  leagueId={leagueRowId}
                  mode="sleeper"
                  sleeperId={leagueId}
                />
              )}

              {/* Go to dashboard */}
              <button
                type="button"
                onClick={() => router.push(`/league/${leagueId}`)}
                className={primaryBtnCls}
              >
                Go to dashboard
                <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
