"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLeagueById,
  getMembers,
  getWeeklyResults,
  leagueRowToManualLeague,
  weeklyResultsToEntries,
  updateLeague,
} from "@/lib/db";
import { calculateSeasonTaxes, totalPot } from "@/lib/calc";
import type { ManualLeague, WeekEntry } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingDown,
  Trophy,
  Check,
  Copy,
  CheckCircle2,
  Link2,
  Settings,
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
    >
      {copied ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
      ) : (
        <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
      )}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManualDashboard() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [supabase] = useState(() => createClient());
  const [league,    setLeague]   = useState<ManualLeague | null>(null);
  const [entries,   setEntries]  = useState<WeekEntry[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [showChampionPicker, setShowChampionPicker] = useState(false);
  const [isCommissioner,     setIsCommissioner]     = useState(false);
  const [currentUserTeamId,  setCurrentUserTeamId]  = useState<string | null>(null);

  const inviteUrl = useMemo(() => {
    if (!isCommissioner || typeof window === "undefined") return null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    return `${appUrl}/join/${leagueId}`;
  }, [isCommissioner, leagueId]);

  const loadData = useCallback(async () => {
    const row = await getLeagueById(supabase, leagueId);
    if (!row) { setLoading(false); return; }

    const [members, weekRows] = await Promise.all([
      getMembers(supabase, leagueId),
      getWeeklyResults(supabase, leagueId),
    ]);

    const manualLeague = leagueRowToManualLeague(row, members);
    const weekEntries  = weeklyResultsToEntries(weekRows, leagueId);

    setLeague(manualLeague);
    setEntries(weekEntries);

    if (user) {
      const myMember = members.find((m) => m.user_id === user.id);
      if (myMember) {
        setIsCommissioner(myMember.role === "commissioner");
        setCurrentUserTeamId(myMember.id);
      }
    }

    setLoading(false);
  }, [supabase, leagueId, user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function setChampion(teamId: string) {
    if (!league) return;
    await updateLeague(supabase, leagueId, { champion_team_id: teamId });
    setLeague({ ...league, championTeamId: teamId });
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
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-100 truncate">{league.name}</p>
            {isCommissioner && (
              <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded px-1.5 py-0.5">
                Commissioner
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">{league.teams.length} teams</p>
        </div>
        {isCommissioner && inviteUrl && (
          <div className="flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" strokeWidth={1.5} />
            <CopyButton text={inviteUrl} />
          </div>
        )}
        {isCommissioner && (
          <Link
            href={`/m/${leagueId}/settings`}
            className="text-slate-600 hover:text-slate-300 transition-colors p-1 flex-shrink-0"
            title="Edit league settings"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        )}
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
            {champion && isCommissioner ? (
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
                {isCommissioner
                  ? "Designate a champion to calculate final payouts."
                  : "Season still in progress — no champion yet."}
              </p>
              {isCommissioner && (
                <button
                  onClick={() => setShowChampionPicker(true)}
                  className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Set champion
                </button>
              )}
            </div>
          )}

          {/* Champion picker — commissioner only */}
          {showChampionPicker && isCommissioner && (
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
                const isChamp  = team.id === league.championTeamId;
                const isMyTeam = team.id === currentUserTeamId;
                return (
                  <div
                    key={team.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      isMyTeam ? "bg-teal-500/5 border-l-2 border-l-teal-500/30" : ""
                    }`}
                  >
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
                        {isMyTeam && !isChamp && (
                          <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                            You
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
                return isCommissioner ? (
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
                      <p className="text-sm text-slate-200 truncate">{low?.name ?? "Unknown"}</p>
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
                ) : (
                  <div key={entry.week} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-lg bg-navy-700 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-semibold text-slate-600 uppercase">Wk</span>
                      <span className="text-sm font-bold text-slate-400 tabular-nums leading-none">
                        {entry.week}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{low?.name ?? "Unknown"}</p>
                      <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                        <TrendingDown className="w-3 h-3" strokeWidth={1.5} />
                        lowest scorer
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Enter week — commissioner only ── */}
        {isCommissioner && (
          <Link
            href={`/m/${leagueId}/week`}
            className="flex items-center justify-between bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl px-4 py-3.5 transition-colors group"
          >
            <div>
              <p className="text-sm font-semibold text-white">Enter week {nextWeek} results</p>
              <p className="text-xs text-white/60 mt-0.5">Update the pot for this week</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" strokeWidth={2} />
          </Link>
        )}

      </div>
    </main>
  );
}
