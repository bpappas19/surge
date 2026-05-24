"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Zap, TrendingUp, Trophy, ChevronRight } from "lucide-react";

// ─── Animated pot counter ─────────────────────────────────────────────────────

function AnimatedCounter() {
  const START = 2400;
  const END   = 3960;
  const [value, setValue] = useState(START);

  useEffect(() => {
    let current = START;
    let paused  = false;
    let pauseTimer: ReturnType<typeof setTimeout> | null = null;

    const id = setInterval(() => {
      if (paused) return;
      current = Math.min(current + 10, END);
      setValue(current);
      if (current >= END) {
        paused = true;
        pauseTimer = setTimeout(() => {
          current = START;
          setValue(START);
          paused  = false;
        }, 1800);
      }
    }, 50);

    return () => {
      clearInterval(id);
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em]">
        Current pot &middot; Die Nasty League
      </p>
      <p className="text-[56px] sm:text-7xl font-bold text-emerald-400 tabular-nums leading-none">
        ${value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── How it works steps ───────────────────────────────────────────────────────

const steps = [
  {
    Icon: Zap,
    title: "Set your milestones",
    desc: "Commissioner picks what triggers a tax before the season starts.",
  },
  {
    Icon: TrendingUp,
    title: "Watch the pot grow",
    desc: "Every week, milestones hit and leaguemates pay into the pot.",
  },
  {
    Icon: Trophy,
    title: "Winner takes all",
    desc: "Season ends, champion collects everything — more than anyone expected.",
  },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main className="bg-navy-950 flex flex-col min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          minHeight: "calc(100vh - 56px)",
          backgroundImage:
            "url(https://images.unsplash.com/photo-1730657883000-68d4d91d1a0d?q=80&w=2671&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark navy gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(9,13,24,0.30) 0%, rgba(9,13,24,0.55) 50%, rgba(9,13,24,1) 100%)",
          }}
        />

        {/* Large hero logo — top-left, over the background */}
        <div className="absolute top-6 left-5 sm:top-8 sm:left-8 z-10 flex items-center gap-2.5 select-none">
          <Zap
            className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 flex-shrink-0"
            fill="currentColor"
            strokeWidth={0}
          />
          <span className="text-[1.75rem] sm:text-[2.25rem] font-bold tracking-[-0.03em] text-white leading-none">
            Surge
          </span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center text-center px-5 py-16 w-full max-w-3xl mx-auto">

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mt-20 mb-8 select-none">
            <Zap className="w-2.5 h-2.5" fill="currentColor" strokeWidth={0} />
            Fantasy Football · Reimagined
          </div>

          {/* Headline */}
          <h1 className="text-[2.75rem] sm:text-5xl lg:text-[3.25rem] font-medium text-white leading-[1.08] tracking-tight mb-5">
            The pot grows<br />when you win.
          </h1>

          {/* Sub-headline */}
          <p className="text-[17px] sm:text-lg leading-relaxed mb-12 max-w-[440px]"
             style={{ color: "rgba(255,255,255,0.52)" }}>
            Surge adds real stakes to your fantasy league.
            Every milestone. Every week. Winner takes all.
          </p>

          {/* Animated counter */}
          <div className="mb-12">
            <AnimatedCounter />
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <Link
              href="/sleeper"
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors"
            >
              Connect Sleeper
              <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
            </Link>
            <Link
              href="/setup"
              className="flex items-center justify-center border border-white/20 hover:border-white/45 hover:bg-white/5 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-all"
            >
              Manual Setup
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social proof bar ─────────────────────────────────────────────────── */}
      <div className="bg-navy-900 border-y border-navy-700 py-3.5">
        <p className="text-center text-[11px] text-slate-500 tracking-wide select-none">
          <span className="text-emerald-500/55">⚡</span>{" "}
          Joined by{" "}
          <span className="text-slate-400 font-semibold tabular-nums">200+</span>{" "}
          leagues this season
        </p>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="px-5 py-14 sm:py-16">
        <div className="max-w-4xl mx-auto">

          {/* Section label */}
          <p className="text-[13px] text-slate-500 text-center mb-10">
            How Surge works
          </p>

          {/* Steps — vertical divider between columns on desktop */}
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-navy-700/60">
            {steps.map(({ Icon, title, desc }, i) => {
              const pad =
                i === 0 ? "sm:pr-10" : i === 1 ? "sm:px-10" : "sm:pl-10";
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center text-center sm:items-start sm:text-left ${pad}`}
                >
                  {/* Bare icon — no box, no background */}
                  <Icon
                    className="w-7 h-7 text-slate-400 mb-5"
                    strokeWidth={1.5}
                  />

                  {/* Title + green left-accent line (desktop only) */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="hidden sm:block w-0.5 h-6 bg-emerald-500 flex-shrink-0 rounded-full" />
                    <p className="text-[17px] font-medium text-slate-200 leading-snug">
                      {title}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-navy-800 py-8">
        <div className="flex items-center justify-center gap-1.5">
          <Zap
            className="w-3 h-3 text-slate-700"
            fill="currentColor"
            strokeWidth={0}
          />
          <p className="text-xs text-slate-700 select-none">
            Surge · Built for fantasy football leagues
          </p>
        </div>
      </footer>

    </main>
  );
}
