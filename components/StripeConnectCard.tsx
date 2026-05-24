"use client";

/**
 * Post-launch Stripe Connect onboarding card for commissioners.
 * Calls /api/stripe/connect-account and redirects to Stripe's hosted onboarding.
 * Gracefully handles the case where STRIPE_SECRET_KEY is not configured.
 */

import { useState } from "react";
import { CreditCard, ExternalLink, AlertCircle } from "lucide-react";

interface Props {
  leagueId: string;
  mode: "manual" | "sleeper";
  sleeperId?: string;
}

export function StripeConnectCard({ leagueId, mode, sleeperId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleConnect() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/connect-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, mode, sleeperId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl px-5 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#635bff]/10 border border-[#635bff]/25 flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-4 h-4 text-[#7c75ff]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">Set up payments</p>
          <p className="text-xs text-slate-600">Powered by Stripe Connect</p>
        </div>
      </div>

      {/* Benefits */}
      <ul className="space-y-1.5">
        {[
          "Collect buy-ins from members",
          "Receive the pot at season end",
          "Automated surge tax billing",
        ].map((item) => (
          <li key={item} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#635bff] hover:bg-[#5850e0] active:bg-[#4e47c9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            Connect with Stripe
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </>
        )}
      </button>
    </div>
  );
}
