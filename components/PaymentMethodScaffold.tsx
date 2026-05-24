"use client";

/**
 * Payment method collection scaffold for league members.
 * UI is complete; actual Stripe Elements will replace the placeholder
 * inputs in a future iteration. The "Save card" button calls
 * /api/stripe/create-customer to register the user in Stripe.
 */

import { useState } from "react";
import { CreditCard, Lock, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  leagueId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function PaymentMethodScaffold({ leagueId, onComplete, onSkip }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [saved,   setSaved]   = useState(false);

  async function handleSave() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/create-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not save payment method.");
        setLoading(false);
        return;
      }
      setSaved(true);
      setTimeout(onComplete, 800);
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  if (saved) {
    return (
      <div className="bg-navy-800 border border-emerald-500/20 rounded-xl px-5 py-5 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
        <p className="text-sm text-slate-300">Payment method saved!</p>
      </div>
    );
  }

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl px-5 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">Add payment method</p>
          <p className="text-xs text-slate-600">You&apos;ll be billed when surge taxes are due</p>
        </div>
      </div>

      {/* Placeholder card inputs (Stripe Elements will replace these) */}
      <div className="space-y-2.5">
        <div className="bg-navy-900 border border-navy-700 rounded-lg px-3.5 py-2.5 flex items-center gap-2">
          <CreditCard className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" strokeWidth={1.5} />
          <span className="text-sm text-slate-700">Card number</span>
          <span className="ml-auto text-xs text-slate-700">•••• •••• •••• 4242</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-navy-900 border border-navy-700 rounded-lg px-3.5 py-2.5">
            <span className="text-sm text-slate-700">MM / YY</span>
          </div>
          <div className="bg-navy-900 border border-navy-700 rounded-lg px-3.5 py-2.5">
            <span className="text-sm text-slate-700">CVC</span>
          </div>
        </div>
      </div>

      {/* Trust note */}
      <div className="flex items-center gap-1.5">
        <Lock className="w-3 h-3 text-slate-700 flex-shrink-0" strokeWidth={1.5} />
        <p className="text-[10px] text-slate-700">Secured by Stripe — Surge never stores your card details</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            Saving…
          </>
        ) : "Save card"}
      </button>

      <button
        onClick={onSkip}
        className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
      >
        Skip for now
      </button>
    </div>
  );
}
