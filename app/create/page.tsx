"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw, PenLine, ChevronRight, Zap } from "lucide-react";

// ─── Setup option card ────────────────────────────────────────────────────────

interface OptionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  href: string;
  cta: string;
  variant: "emerald" | "outline";
}

function OptionCard({ icon, title, description, badge, href, cta, variant }: OptionCardProps) {
  return (
    <Link
      href={href}
      className={`
        group relative flex flex-col gap-6 rounded-2xl border p-8 lg:p-10
        bg-navy-800 transition-all duration-200
        hover:shadow-[0_0_32px_rgba(20,184,166,0.10)]
        ${variant === "emerald"
          ? "border-navy-600 hover:border-teal-500/50"
          : "border-navy-700 hover:border-navy-500"}
      `}
    >
      {/* Badge */}
      {badge && (
        <span className="absolute top-5 right-5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
          {badge}
        </span>
      )}

      {/* Icon */}
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          variant === "emerald"
            ? "bg-teal-500/10 text-teal-400"
            : "bg-navy-700 text-slate-400"
        }`}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 space-y-2.5">
        <h2 className="text-lg font-bold text-slate-100 leading-snug">{title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>

      {/* CTA */}
      <div
        className={`
          inline-flex items-center gap-2 self-start px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors
          ${variant === "emerald"
            ? "bg-emerald-600 hover:bg-emerald-500 text-white group-hover:bg-emerald-500"
            : "border border-navy-600 text-slate-300 group-hover:border-navy-500 group-hover:text-slate-100"}
        `}
      >
        {cta}
        <ChevronRight className="w-4 h-4" strokeWidth={2} />
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/signup?next=/create");
    }
  }, [loading, user, router]);

  // Show nothing while auth resolves or redirect is in flight
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-navy-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-navy-950 flex flex-col items-center justify-center px-4 py-16">

      {/* Header */}
      <div className="text-center mb-12 max-w-lg mx-auto">
        <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mb-6 select-none">
          <Zap className="w-2.5 h-2.5" fill="currentColor" strokeWidth={0} />
          New league
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight leading-tight mb-3">
          Create your Surge
        </h1>
        <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
          Connect your fantasy platform or set up manually.
        </p>
      </div>

      {/* Cards */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        <OptionCard
          icon={<RefreshCw className="w-5 h-5" strokeWidth={1.75} />}
          title="Connect Sleeper"
          description="Automatically sync rosters, scores, and standings. Set up in under a minute."
          badge="Recommended"
          href="/sleeper"
          cta="Connect Sleeper"
          variant="emerald"
        />
        <OptionCard
          icon={<PenLine className="w-5 h-5" strokeWidth={1.75} />}
          title="Manual Setup"
          description="Works with ESPN, Yahoo, NFL.com — commissioner enters weekly results in 60 seconds."
          href="/setup"
          cta="Set up manually"
          variant="outline"
        />
      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-700 mt-8 text-center">
        You can always switch later from league settings.
      </p>
    </main>
  );
}
