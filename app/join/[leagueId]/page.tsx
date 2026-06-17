"use client";

/**
 * /join/[leagueId] — Invite flow entry point.
 *
 * leagueId = Supabase leagues.id UUID (same for both manual and Sleeper leagues).
 *
 * States:
 *  loading      — fetching league + checking auth
 *  not-found    — league doesn't exist
 *  needs-auth   — user not logged in; shows hero sell + embedded sign in / sign up form
 *  join-form    — user is logged in but not yet a member; pick team name
 *  stripe-step  — user joined; show payment method scaffold
 *  done         — redirecting to dashboard
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { getLeagueById, getMember, addMember, getManualTeams, claimManualTeam } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentMethodScaffold } from "@/components/PaymentMethodScaffold";
import { ClaimTeamList } from "@/components/ClaimTeamList";
import type { LeagueRow, MemberRow, ManualTeamRow } from "@/lib/db";

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-white/5 border border-white/10 focus:border-emerald-500/40 " +
  "rounded-xl px-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-500 " +
  "outline-none transition-colors";

const primaryBtnCls =
  "w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 " +
  "active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed " +
  "text-white font-semibold rounded-xl py-3 text-base transition-colors " +
  "shadow-lg shadow-emerald-950/50";

type PageState = "loading" | "not-found" | "needs-auth" | "join-form" | "claim-team" | "stripe-step" | "done";
type AuthTab   = "signin" | "signup";

// ─── Pot calculators ──────────────────────────────────────────────────────────

const TOTAL_WEEKS = 14;

function computeCurrentPot(row: LeagueRow): number {
  const base = row.buy_in * row.team_count;
  return row.mode === "sleeper" ? base + (row.surge_deposit ?? 0) : base;
}

function computeMaxPotential(row: LeagueRow): number {
  const current = computeCurrentPot(row);
  const maxPerWeek = row.base_penalty * (row.bottom_scorers_count ?? 1);
  return current + TOTAL_WEEKS * maxPerWeek;
}

// ─── Glow animation ───────────────────────────────────────────────────────────

const glowKeyframes = `
@keyframes potGlow {
  0%, 100% {
    text-shadow:
      0 0 18px rgba(52, 211, 153, 0.30),
      0 0 40px rgba(52, 211, 153, 0.10);
  }
  50% {
    text-shadow:
      0 0 28px rgba(52, 211, 153, 0.60),
      0 0 60px rgba(52, 211, 153, 0.22),
      0 0 90px rgba(52, 211, 153, 0.08);
  }
}
.pot-glow { animation: potGlow 2.6s ease-in-out infinite; }
`;

// ─── Stadium background ───────────────────────────────────────────────────────

const STADIUM_BG =
  "url(https://images.unsplash.com/photo-1730657883000-68d4d91d1a0d?q=80&w=2671&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router       = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [supabase]   = useState(() => createClient());
  const [pageState,  setPageState]  = useState<PageState>("loading");
  const [league,     setLeague]     = useState<LeagueRow | null>(null);
  // membership is set as a side-effect — keeps state coherent for future steps
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_membership, setMembership] = useState<MemberRow | null>(null);

  // Auth form state
  const [authTab,      setAuthTab]      = useState<AuthTab>("signin");
  const [authEmail,    setAuthEmail]    = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName,     setAuthName]     = useState("");
  const [authBusy,     setAuthBusy]     = useState(false);
  const [authError,    setAuthError]    = useState("");

  // Join form state
  const [teamName,  setTeamName]  = useState("");
  const [joining,   setJoining]   = useState(false);
  const [joinError, setJoinError] = useState("");

  // Manual league team-claim state
  const [manualTeams, setManualTeams] = useState<ManualTeamRow[]>([]);

  const dashboardHref = league
    ? league.mode === "sleeper" && league.sleeper_league_id
      ? `/league/${league.sleeper_league_id}`
      : `/m/${league.id}`
    : "/";

  // ── Step 1: load league ────────────────────────────────────────────────────

  useEffect(() => {
    getLeagueById(supabase, leagueId).then((row) => {
      if (!row) { setPageState("not-found"); return; }
      setLeague(row);
    });
  }, [leagueId, supabase]);

  // ── Step 2: once league + auth are both resolved, decide what to show ──────

  const checkMembership = useCallback(async () => {
    if (!league || !user) return;

    if (league.mode === "manual") {
      // Ensure the user has a league_members row (for role/payment tracking),
      // then check whether they've claimed one of the commissioner's teams yet.
      let existing = await getMember(supabase, league.id, user.id);
      if (!existing) {
        const name = (user.user_metadata?.display_name as string | undefined) ?? "Member";
        existing = await addMember(supabase, league.id, user.id, "member", name);
      }
      setMembership(existing);

      const teams = await getManualTeams(supabase, league.id);
      const alreadyClaimed = teams.some((t) => t.claimed_by_user_id === user.id);
      if (alreadyClaimed) {
        router.replace(dashboardHref);
      } else {
        setManualTeams(teams);
        setPageState("claim-team");
      }
      return;
    }

    const existing = await getMember(supabase, league.id, user.id);
    if (existing) {
      setMembership(existing);
      router.replace(dashboardHref);
    } else {
      const name = (user.user_metadata?.display_name as string | undefined) ?? "";
      setTeamName(name);
      setPageState("join-form");
    }
  }, [league, user, supabase, dashboardHref, router]);

  useEffect(() => {
    if (!league) return;
    if (authLoading) return;
    if (!user) {
      setPageState("needs-auth");
    } else {
      checkMembership();
    }
  }, [league, user, authLoading, checkMembership]);

  // ── Auth handler ───────────────────────────────────────────────────────────

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");

    if (authTab === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) { setAuthError(error.message); setAuthBusy(false); return; }
    } else {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { display_name: authName.trim() || authEmail.split("@")[0] } },
      });
      if (error) { setAuthError(error.message); setAuthBusy(false); return; }
    }

    setAuthBusy(false);
    // Auth state change re-triggers the useEffect above to check membership
  }

  // ── Claim team handler (manual leagues) ───────────────────────────────────

  async function handleClaimTeam(teamId: string) {
    if (!user) return;
    const claimed = await claimManualTeam(supabase, teamId, user.id);
    if (!claimed) {
      // Someone else claimed it first — refresh the list so it shows as taken.
      if (league) setManualTeams(await getManualTeams(supabase, league.id));
      throw new Error("That team was just claimed by someone else — pick another.");
    }
    setPageState("stripe-step");
  }

  // ── Join handler ───────────────────────────────────────────────────────────

  async function handleJoin() {
    if (!user || !league) return;
    setJoining(true);
    setJoinError("");
    try {
      const member = await addMember(
        supabase, league.id, user.id, "member",
        teamName.trim() || "Member"
      );
      setMembership(member);
      setPageState("stripe-step");
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join league.");
    } finally {
      setJoining(false);
    }
  }

  // ── Derived pot numbers ────────────────────────────────────────────────────

  const currentPot = league ? computeCurrentPot(league) : 0;
  const maxPot     = league ? computeMaxPotential(league) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Glow keyframes injected once */}
      <style>{glowKeyframes}</style>

      <main
        className="relative flex flex-col items-center px-5 pb-16 pt-[10vh]"
        style={{
          minHeight: "calc(100vh - 64px)",
          backgroundImage: STADIUM_BG,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Heavy dark overlay — fades from semi-transparent at top to near-opaque at bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(9,13,24,0.78) 0%, rgba(9,13,24,0.88) 40%, rgba(9,13,24,0.97) 70%, rgb(9,13,24) 100%)",
          }}
        />

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="relative z-10 w-full max-w-sm flex flex-col items-center">

          {/* Surge logo + wordmark — always visible */}
          <div className="flex items-center gap-2 mb-10 select-none">
            <Zap
              className="w-6 h-6 text-emerald-400"
              fill="currentColor"
              strokeWidth={0}
            />
            <span className="text-xl font-bold tracking-tight text-white leading-none">
              Surge
            </span>
          </div>

          {/* ── Loading ── */}
          {pageState === "loading" && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-white/10 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}

          {/* ── Not found ── */}
          {pageState === "not-found" && (
            <div className="flex flex-col items-center text-center py-10">
              <AlertCircle className="w-8 h-8 text-slate-600 mb-4" strokeWidth={1.5} />
              <p className="text-sm font-medium text-slate-300 mb-1">League not found</p>
              <p className="text-xs text-slate-600 mb-6">
                This invite link may be invalid or expired.
              </p>
              <Link
                href="/"
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Back to home
              </Link>
            </div>
          )}

          {/* ── Hero league info — shown for needs-auth, join-form, and claim-team ── */}
          {league && (pageState === "needs-auth" || pageState === "join-form" || pageState === "claim-team") && (
            <div className="flex flex-col items-center text-center w-full mb-8">
              {/* Invite label */}
              <p className="text-sm text-slate-400 mb-2">You&apos;ve been invited to join</p>

              {/* League name */}
              <h1 className="text-[1.75rem] font-bold text-white leading-tight mb-8 px-1">
                {league.name}
              </h1>

              {/* Pot display */}
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium mb-1.5">
                Current pot
              </p>
              <p className="text-6xl sm:text-7xl font-bold text-emerald-400 tabular-nums leading-none pot-glow">
                ${currentPot.toLocaleString()}
              </p>

              {/* Max potential */}
              {maxPot > currentPot && (
                <p className="text-emerald-400 text-xl font-semibold mt-3">
                  Could reach ${maxPot.toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* ── Pitch line — needs-auth only ── */}
          {pageState === "needs-auth" && league && (
            <p className="text-[15px] leading-relaxed text-slate-400 text-center mb-9 px-2">
              Every week, the lowest scorers pay into this pot.
              The season winner takes everything.
            </p>
          )}

          {/* ── Auth form — needs-auth ── */}
          {pageState === "needs-auth" && league && (
            <div className="w-full">
              {/* Tabs */}
              <div className="flex border-b border-white/10 mb-5">
                {(["signin", "signup"] as AuthTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setAuthTab(tab); setAuthError(""); }}
                    className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                      authTab === tab
                        ? "text-white border-b-2 border-emerald-500"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                {authTab === "signup" && (
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Display name"
                    className={inputCls}
                  />
                )}
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  required
                  className={inputCls}
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder={authTab === "signup" ? "Password (min. 6 chars)" : "Password"}
                  autoComplete={authTab === "signup" ? "new-password" : "current-password"}
                  required
                  className={inputCls}
                />

                {authError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                    <AlertCircle
                      className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5"
                      strokeWidth={1.5}
                    />
                    <p className="text-xs text-red-400">{authError}</p>
                  </div>
                )}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={authBusy || !authEmail || !authPassword}
                    className={primaryBtnCls}
                  >
                    {authBusy ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        {authTab === "signin" ? "Signing in…" : "Creating account…"}
                      </>
                    ) : (
                      "Join & claim your spot"
                    )}
                  </button>
                </div>
              </form>

              <p className="text-center text-xs text-slate-600 mt-4">
                Free to join · No payment required until season starts
              </p>
            </div>
          )}

          {/* ── Join form — set team name ── */}
          {pageState === "join-form" && league && (
            <div className="w-full">
              <label className="block text-xs text-slate-500 mb-2">
                Your team name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. The Gronkowski Effect"
                className={inputCls}
                autoFocus
              />

              {joinError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mt-3">
                  <AlertCircle
                    className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5"
                    strokeWidth={1.5}
                  />
                  <p className="text-xs text-red-400">{joinError}</p>
                </div>
              )}

              <div className="pt-3">
                <button
                  onClick={handleJoin}
                  disabled={joining || !teamName.trim()}
                  className={primaryBtnCls}
                >
                  {joining ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Joining…
                    </>
                  ) : (
                    "Confirm & join league"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Claim team — manual leagues ── */}
          {pageState === "claim-team" && league && (
            <ClaimTeamList teams={manualTeams} onClaim={handleClaimTeam} />
          )}

          {/* ── Stripe step ── */}
          {pageState === "stripe-step" && league && (
            <div className="w-full space-y-5">
              <div className="flex flex-col items-center text-center mb-2">
                <div className="flex items-center gap-2.5 mb-2">
                  <CheckCircle2
                    className="w-5 h-5 text-emerald-400"
                    strokeWidth={1.5}
                  />
                  <p className="text-lg font-semibold text-white">
                    You&apos;re in!
                  </p>
                </div>
                <p className="text-sm text-slate-500">
                  Welcome to{" "}
                  <span className="text-slate-300">{league.name}</span>
                </p>
              </div>

              <PaymentMethodScaffold
                leagueId={league.id}
                onComplete={() => router.push(dashboardHref)}
                onSkip={() => router.push(dashboardHref)}
              />
            </div>
          )}

          {/* ── Done ── */}
          {pageState === "done" && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-white/10 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}

        </div>
      </main>
    </>
  );
}
