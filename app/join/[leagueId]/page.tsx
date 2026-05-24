"use client";

/**
 * /join/[leagueId] — Invite flow entry point.
 *
 * leagueId = Supabase leagues.id UUID (same for both manual and Sleeper leagues).
 *
 * States:
 *  loading      — fetching league + checking auth
 *  not-found    — league doesn't exist
 *  needs-auth   — user not logged in; shows embedded sign in / sign up form
 *  join-form    — user is logged in but not yet a member
 *  stripe-step  — user joined; show payment method scaffold
 *  done         — redirecting to dashboard
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, AlertCircle, Users, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { getLeagueById, getMember, addMember } from "@/lib/db";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentMethodScaffold } from "@/components/PaymentMethodScaffold";
import type { LeagueRow, MemberRow } from "@/lib/db";

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-navy-900 border border-navy-700 focus:border-teal-500/40 " +
  "rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 " +
  "outline-none transition-colors";

const primaryBtnCls =
  "w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 " +
  "active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed " +
  "text-white font-medium rounded-lg py-2.5 text-sm transition-colors";

type PageState = "loading" | "not-found" | "needs-auth" | "join-form" | "stripe-step" | "done";
type AuthTab   = "signin" | "signup";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router       = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [supabase]    = useState(() => createClient());
  const [pageState,   setPageState]   = useState<PageState>("loading");
  const [league,      setLeague]      = useState<LeagueRow | null>(null);
  const [membership,  setMembership]  = useState<MemberRow | null>(null);

  // Auth form state
  const [authTab,      setAuthTab]      = useState<AuthTab>("signin");
  const [authEmail,    setAuthEmail]    = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName,     setAuthName]     = useState("");
  const [authLoading2, setAuthLoading2] = useState(false);
  const [authError,    setAuthError]    = useState("");

  // Join form state
  const [teamName,     setTeamName]     = useState("");
  const [joining,      setJoining]      = useState(false);
  const [joinError,    setJoinError]    = useState("");

  // Dashboard href computed from league mode
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
    const existing = await getMember(supabase, league.id, user.id);
    if (existing) {
      setMembership(existing);
      router.replace(dashboardHref);
    } else {
      const name =
        (user.user_metadata?.display_name as string | undefined) ?? "";
      setTeamName(name);
      setPageState("join-form");
    }
  }, [league, user, supabase, dashboardHref, router]);

  useEffect(() => {
    if (!league) return; // wait for league to load
    if (authLoading) return; // wait for auth context

    if (!user) {
      setPageState("needs-auth");
    } else {
      checkMembership();
    }
  }, [league, user, authLoading, checkMembership]);

  // ── Auth handlers ──────────────────────────────────────────────────────────

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading2(true);
    setAuthError("");

    if (authTab === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) { setAuthError(error.message); setAuthLoading2(false); return; }
    } else {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { display_name: authName.trim() || authEmail.split("@")[0] } },
      });
      if (error) { setAuthError(error.message); setAuthLoading2(false); return; }
    }
    setAuthLoading2(false);
    // Auth state change will trigger the useEffect above to re-check membership
  }

  // ── Join handler ───────────────────────────────────────────────────────────

  async function handleJoin() {
    if (!user || !league) return;
    setJoining(true);
    setJoinError("");
    try {
      const member = await addMember(supabase, league.id, user.id, "member", teamName.trim() || "Member");
      setMembership(member);
      setPageState("stripe-step");
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join league.");
    } finally {
      setJoining(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main
      className="bg-navy-950 flex flex-col items-center px-4 pb-12 pt-[12vh]"
      style={{ minHeight: "calc(100vh - 56px)" }}
    >
      <div className="w-full max-w-sm space-y-4">

        {/* ── Loading ── */}
        {pageState === "loading" && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-navy-700 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {/* ── Not found ── */}
        {pageState === "not-found" && (
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-8 text-center">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-slate-300">League not found</p>
            <p className="text-xs text-slate-600 mt-1 mb-5">This invite link may be invalid or expired.</p>
            <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
              Back to home
            </Link>
          </div>
        )}

        {/* ── Needs auth ── */}
        {pageState === "needs-auth" && league && (
          <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
            {/* League identity */}
            <div className="px-6 pt-6 pb-5 border-b border-navy-700">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-emerald-400" fill="currentColor" strokeWidth={0} />
                <span className="text-xs font-bold text-slate-400 tracking-tight">Surge</span>
              </div>
              <p className="text-base font-semibold text-slate-100">You&apos;re invited to join</p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3 h-3 text-emerald-400" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-emerald-400 truncate">{league.name}</p>
              </div>
              <p className="text-xs text-slate-600 mt-1">{league.team_count} teams · ${league.buy_in} buy-in</p>
            </div>

            {/* Auth tabs */}
            <div className="flex border-b border-navy-700">
              {(["signin", "signup"] as AuthTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setAuthTab(tab); setAuthError(""); }}
                  className={`flex-1 py-3 text-xs font-medium transition-colors ${
                    authTab === tab
                      ? "text-slate-100 border-b-2 border-emerald-500"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <div className="px-6 py-5">
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
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    <p className="text-xs text-red-400">{authError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading2 || !authEmail || !authPassword}
                  className={primaryBtnCls}
                >
                  {authLoading2 ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      {authTab === "signin" ? "Signing in…" : "Creating account…"}
                    </>
                  ) : (
                    authTab === "signin" ? "Sign in & join" : "Create account & join"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Join form ── */}
        {pageState === "join-form" && league && (
          <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
            {/* League identity */}
            <div className="px-6 pt-6 pb-5 border-b border-navy-700">
              <p className="text-base font-semibold text-slate-100">Join league</p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3 h-3 text-emerald-400" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-emerald-400 truncate">{league.name}</p>
              </div>
              <p className="text-xs text-slate-600 mt-1">{league.team_count} teams · ${league.buy_in} buy-in</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Your team name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. The Gronkowski Effect"
                  className={inputCls}
                  autoFocus
                />
              </div>

              {joinError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-xs text-red-400">{joinError}</p>
                </div>
              )}

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
                ) : "Join league"}
              </button>
            </div>
          </div>
        )}

        {/* ── Stripe step ── */}
        {pageState === "stripe-step" && league && (
          <div className="space-y-4">
            <div className="bg-navy-800 border border-emerald-500/20 rounded-2xl px-6 py-5">
              <div className="flex items-center gap-2.5 mb-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-slate-100">You&apos;re in!</p>
              </div>
              <p className="text-xs text-slate-600 ml-7">
                Welcome to <span className="text-slate-400">{league.name}</span>
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
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-navy-700 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

      </div>
    </main>
  );
}
