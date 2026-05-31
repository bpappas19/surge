"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-navy-900 border border-navy-700 focus:border-teal-500/40 " +
  "rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 " +
  "outline-none transition-colors";

const primaryBtnCls =
  "w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 " +
  "active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed " +
  "text-white font-medium rounded-lg py-2.5 text-sm transition-colors";

// ─── Forgot password inline form ─────────────────────────────────────────────

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [sent,    setSent]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: (process.env.NEXT_PUBLIC_APP_URL ?? "") + "/auth/reset-password",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="px-8 py-7">
      <button
        onClick={onBack}
        className="text-xs text-slate-600 hover:text-slate-400 transition-colors mb-5 flex items-center gap-1"
      >
        ← Back to sign in
      </button>

      {sent ? (
        <p className="text-sm text-emerald-400">Check your email for a reset link.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className={inputCls}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-3">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading || !email} className={primaryBtnCls}>
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Sending…
              </>
            ) : "Send reset link"}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Inner component (uses useSearchParams — must be inside Suspense) ─────────

function LoginForm() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const next          = searchParams.get("next") ?? "/";

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [showForgot,    setShowForgot]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // router.refresh() forces Server Components to re-render with the new session
    router.push(next);
    router.refresh();
  }

  const signupHref = next !== "/" ? `/auth/signup?next=${encodeURIComponent(next)}` : "/auth/signup";

  return (
    <main
      className="bg-navy-950 flex flex-col items-center px-4 pb-12 pt-[12vh]"
      style={{ minHeight: "calc(100vh - 56px)" }}
    >
      <div className="w-full max-w-sm bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-navy-700">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-5 h-5 text-emerald-400" fill="currentColor" strokeWidth={0} />
            <span className="text-sm font-bold text-white tracking-tight">Surge</span>
          </div>
          {showForgot ? (
            <>
              <p className="text-base font-semibold text-slate-100">Reset password</p>
              <p className="text-xs text-slate-500 mt-1">We&apos;ll email you a link</p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-100">Welcome back</p>
              <p className="text-xs text-slate-500 mt-1">Sign in to your account</p>
            </>
          )}
        </div>

        {/* Body */}
        {showForgot ? (
          <ForgotPasswordForm onBack={() => setShowForgot(false)} />
        ) : (
          <div className="px-8 py-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className={inputCls}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-3">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading || !email || !password} className={primaryBtnCls}>
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : "Sign in"}
              </button>
            </form>

            <p className="text-xs text-slate-600 text-center mt-5">
              Don&apos;t have an account?{" "}
              <Link href={signupHref} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                Sign up
              </Link>
            </p>
            <p className="text-xs text-center mt-2">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                Forgot password?
              </button>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Page (wraps inner component in Suspense for useSearchParams) ─────────────

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
