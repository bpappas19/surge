"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getLeague, getWeekEntries, saveLeague } from "@/lib/storage";
import { calculateSeasonTaxes, totalPot } from "@/lib/calc";
import type { ManualLeague, WeekEntry } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingDown,
  Trophy,
  ChevronDown,
  Check,
} from "lucide-react";

// ─── Shared ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManualDashboard() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  const [league, setLeague]   = useState<ManualLeague | null>(null);
  const [entries, setEntries] = useState<WeekEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChampionPicker, setShowChampionPicker] = useState(false);

  useEffect(() => {
    const l = getLeague(leagueId);
    const e = getWeekEntries(leagueId);
    setLeague(l);
    setEntries(e);
    setLoading(false);
  }, [leagueId]);

  function setChampion(teamId: string) {
    if (!league) return;
    const updated = { ...league, championTeamId: teamId };
    saveLeague(updated);
    setLeague(updated);
    setShowChampionPicker(false);
  }

  const seasonRecords = useMemo(
    () => (league ? calculateSeasonTaxes(entries, league) : []),
    [entries, league]
  );

  const pot = useMemo(
    () => (league ? totalPot(entries, league) : 0),
    [entries, league]
  );

  const champion = useMemo(
    () => league?.teams.find((t) => t.id === league.championTeamId),
    [league]
  );
  const champDebt = useMemo(
    () =>
      league?.championTeamId
        ? (seasonRecords.find((r) => r.team.id === league.championTeamId)?.totalOwed ?? 0)
        : 0,
    [league, seasonRecords]
  );
  const nextWeek = (entries[entries.length - 1]?.week ?? 0) + 1;

  // ── Loading / not found ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-navy-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-slate-400 text-sm">League not found.</p>
        <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          Back to home
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-12">
      {/* Inline page header */}
      <div className="w-full max-w-2xl mx-auto px-4 pt-5 pb-2 flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{league.name}</p>
          <p className="text-xs text-slate-600">{league.teams.length} teams</p>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 space-y-4">

        {/* ── Pot total ── */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Total pot
          </p>
          {league.config.buyIn ? (
            <>
              <p className="text-4xl font-bold text-slate-100 tabular-nums">
                ${((league.config.buyIn * league.teams.length) + pot).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                <span className="text-slate-400 tabular-nums">
                  ${(league.config.buyIn * league.teams.length).toLocaleString()}
                </span>
                {" starting pot"}
                {pot > 0 && (
                  <>
                    {" + "}
                    <span className="text-slate-400 tabular-nums">${pot}</span>
                    {" in surges"}
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold text-slate-100 tabular-nums">${pot}</p>
              <p className="text-xs text-slate-600 mt-1.5">
                {entries.length} week{entries.length !== 1 ? "s" : ""} · $
                {league.config.basePenalty} base penalty
              </p>
            </>
          )}
        </div>

        {/* ── Champion section ── */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 flex items-center justify-between border-b border-navy-700">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
              <p className="text-sm font-medium text-slate-200">Season winner</p>
            </div>
            {champion ? (
              <button
                onClick={() => setShowChampionPicker(true)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Change
              </button>
            ) : null}
          </div>

          {champion ? (
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-amber-400">{initials(champion.name)}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{champion.name}</p>
                  <p className="text-xs text-slate-600">Champion</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1 border-t border-navy-700">
                <div>
                  <p className="text-[10px] text-slate-600 mb-0.5 uppercase tracking-wider">Pot</p>
                  <p className="text-lg font-bold text-slate-100 tabular-nums">${pot}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 mb-0.5 uppercase tracking-wider">Own debt</p>
                  <p className="text-lg font-bold text-red-400 tabular-nums">
                    {champDebt > 0 ? `-$${champDebt}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-600 mb-0.5 uppercase tracking-wider">Receives</p>
                  <p className="text-lg font-bold text-emerald-400 tabular-nums">
                    ${pot - champDebt}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-4">
              <p className="text-sm text-slate-500 mb-3">
                Designate a champion to calculate final payouts.
              </p>
              <button
                onClick={() => setShowChampionPicker(true)}
                className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                Set champion
              </button>
            </div>
          )}

          {/* Champion picker dropdown */}
          {showChampionPicker && (
            <div className="border-t border-navy-700 bg-navy-850 divide-y divide-navy-700">
              {league.teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setChampion(team.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-navy-750 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-navy-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-slate-400">
                      {initials(team.name)}
                    </span>
                  </div>
                  <span className="text-sm text-slate-200 flex-1">{team.name}</span>
                  {team.id === league.championTeamId && (
                    <Check className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />
                  )}
                </button>
              ))}
              <button
                onClick={() => setShowChampionPicker(false)}
                className="w-full px-4 py-3 text-sm text-slate-500 hover:text-slate-300 transition-colors text-center"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* ── Tax standings ── */}
        <section>
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-2 px-1">
            Tax standings
          </p>
          <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden divide-y divide-navy-700">
            {seasonRecords.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-600">
                No results yet — enter week 1 to get started.
              </p>
            ) : (
              seasonRecords.map(({ team, totalOwed, weekBreakdown }) => {
                const isChamp = team.id === league.championTeamId;
                return (
                  <div key={team.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isChamp
                          ? "bg-amber-500/15 border border-amber-500/25"
                          : "bg-navy-700"
                      }`}
                    >
                      <span
                        className={`text-xs font-semibold ${
                          isChamp ? "text-amber-400" : "text-slate-500"
                        }`}
                      >
                        {initials(team.name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-100 truncate">{team.name}</p>
                        {isChamp && (
                          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                            Champ
                          </span>
                        )}
                      </div>
                      {weekBreakdown.length > 0 && (
                        <p className="text-xs text-slate-600 mt-0.5">
                          Wk {weekBreakdown.map((w) => w.week).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {totalOwed > 0 ? (
                        <p className="text-sm font-semibold text-red-400 tabular-nums">
                          −${totalOwed}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-600">—</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── Weekly history ── */}
        {entries.length > 0 && (
          <section>
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-2 px-1">
              Weekly history
            </p>
            <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden divide-y divide-navy-700">
              {[...entries].reverse().map((entry) => {
                const low = league.teams.find((t) => t.id === entry.lowestScorerTeamId);
                return (
                  <Link
                    key={entry.week}
                    href={`/m/${leagueId}/week?week=${entry.week}`}
                    className="group flex items-center gap-3 px-4 py-3.5 hover:bg-navy-750 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-navy-700 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-semibold text-slate-600 uppercase">Wk</span>
                      <span className="text-sm font-bold text-slate-400 tabular-nums leading-none">
                        {entry.week}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">
                        {low?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                        <TrendingDown className="w-3 h-3" strokeWidth={1.5} />
                        lowest scorer
                      </p>
                    </div>
                    <ChevronRight
                      className="w-4 h-4 text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors"
                      strokeWidth={1.5}
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Enter week ── */}
        <Link
          href={`/m/${leagueId}/week`}
          className="flex items-center justify-between bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 rounded-xl px-4 py-3.5 transition-colors group"
        >
          <div>
            <p className="text-sm font-semibold text-black">Enter week {nextWeek} results</p>
            <p className="text-xs text-black/60 mt-0.5">Update the pot for this week</p>
          </div>
          <ChevronRight className="w-4 h-4 text-black/70 group-hover:text-black transition-colors" strokeWidth={2} />
        </Link>

      </div>
    </main>
  );
}
