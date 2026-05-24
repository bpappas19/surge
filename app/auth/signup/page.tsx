"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, AlertCircle, CheckCircle2 } from "lucide-react";
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

// ─── Inner component ─────────────────────────────────────────────────────────

function SignupForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") ?? "/";

  const [displayName, setDisplayName] = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [done,        setDone]        = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() || email.split("@")[0] },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled in Supabase, session is immediately available
    if (data.session) {
      router.push(next);
      router.refresh();
    } else {
      // Email confirmation required
      setDone(true);
    }
  }

  const loginHref = next !== "/" ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login";

  if (done) {
    return (
      <main
        className="bg-navy-950 flex flex-col items-center px-4 pb-12 pt-[12vh]"
        style={{ minHeight: "calc(100vh - 56px)" }}
      >
        <div className="w-full max-w-sm bg-navy-800 border border-navy-700 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-base font-semibold text-slate-100">Check your email</p>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            We sent a confirmation link to <span className="text-slate-300">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <Link href={loginHref} className="inline-block mt-6 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
            Back to sign in →
          </Link>
        </div>
      </main>
    );
  }

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
          <p className="text-base font-semibold text-slate-100">Create your account</p>
          <p className="text-xs text-slate-500 mt-1">Start tracking your league pot</p>
        </div>

        {/* Form */}
        <div className="px-8 py-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ben"
                autoComplete="name"
                className={inputCls}
              />
            </div>
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
                placeholder="Min. 6 characters"
                autoComplete="new-password"
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

            <button
              type="submit"
              disabled={loading || !email || !password}
              className={primaryBtnCls}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Creating account…
                </>
              ) : "Create account"}
            </button>
          </form>

          <p className="text-xs text-slate-600 text-center mt-5">
            Already have an account?{" "}
            <Link href={loginHref} className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
