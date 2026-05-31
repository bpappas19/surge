"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);

  // Redirect to login after success
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => router.push("/auth/login"), 2000);
    return () => clearTimeout(t);
  }, [success, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
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
          <p className="text-base font-semibold text-slate-100">Set new password</p>
          <p className="text-xs text-slate-500 mt-1">Choose a password for your account</p>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          {success ? (
            <p className="text-sm text-emerald-400">Password updated! Redirecting to sign in…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
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
                disabled={loading || !password || !confirm}
                className={primaryBtnCls}
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Updating…
                  </>
                ) : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
