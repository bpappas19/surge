"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getMatchups,
  getWinnersBracket,
  findChampionRosterId,
  avatarUrl,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperRoster,
  SleeperMatchup,
} from "@/lib/sleeper";
import { getSleeperSettings } from "@/lib/storage";
import { getLeagueConfig, SleeperLeagueConfig } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-browser";
import { getLeagueBySleeperLeagueId } from "@/lib/db";
import { totalPot, calculateSeasonTaxes } from "@/lib/calc";
import type { ManualLeague, WeekEntry } from "@/lib/types";
import {
  ChevronLeft,
  Trophy,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

interface TeamInfo {
  rosterId: number;
  ownerId: string;
  displayName: string;
  teamName: string;
  avatar: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildWeekEntry(
  week: number,
  leagueId: string,
  matchups: SleeperMatchup[]
): WeekEntry | null {
  const valid = matchups.filter((m) => m.points > 0);
  if (!valid.length) return null;

  return {
    leagueId,
    week,
    scores: valid.map((m) => ({ teamId: String(m.roster_id), points: m.points })),
    submittedAt: "",
  };
}

// ─── Avatar ────────────────────────────────────────────────────────────────

function Avatar({
  src,
  name,
  size = "md",
  className = "",
}: {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-base" }[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={`${dim} ${className} rounded-full object-cover flex-shrink-0`} />
    );
  }
  return (
    <div
      className={`${dim} ${className} rounded-full bg-white/5 border border-white/6 flex items-center justify-center flex-shrink-0 font-semibold text-slate-500`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function PayoutsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  const [supabase] = useState(() => createClient());
  const [league, setLeague]               = useState<SleeperLeague | null>(null);
  const [teams, setTeams]                 = useState<Map<number, TeamInfo>>(new Map());
  const [taxByRoster, setTaxByRoster]     = useState<Map<number, number>>(new Map());
  const [surgeTotal, setSurgeTotal]       = useState(0);
  const [config, setConfig]               = useState<SleeperLeagueConfig | null>(null);
  const [championId, setChampionId]       = useState<number | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [leagueData, rosters, users, bracket, leagueRow, legacyConfig] = await Promise.all([
        getLeague(leagueId),
        getLeagueRosters(leagueId),
        getLeagueUsers(leagueId),
        getWinnersBracket(leagueId).catch(() => []),
        getLeagueBySleeperLeagueId(supabase, leagueId).catch(() => null),
        getLeagueConfig(leagueId).catch(() => null),
      ]);

      setLeague(leagueData);
      setChampionId(findChampionRosterId(bracket));

      // Same config priority as dashboard: leagues table → legacy supabase → localStorage
      let resolvedConfig: SleeperLeagueConfig | null = null;
      if (leagueRow) {
        resolvedConfig = {
          league_id:    leagueId,
          season:       leagueRow.season,
          buy_in:       leagueRow.buy_in,
          team_count:   leagueRow.team_count,
          base_penalty: leagueRow.base_penalty,
          bottom_scorers_count: leagueRow.bottom_scorers_count ?? 1,
          created_at:   leagueRow.created_at,
        };
      } else if (legacyConfig) {
        resolvedConfig = legacyConfig;
      } else {
        const local = getSleeperSettings(leagueId);
        if (local) {
          resolvedConfig = {
            league_id:    leagueId,
            season:       leagueData.season,
            buy_in:       local.buyIn,
            team_count:   local.teamCount,
            base_penalty: 25,
            bottom_scorers_count: 1,
          };
        }
      }
      setConfig(resolvedConfig);

      const userMap = new Map<string, SleeperLeagueUser>(users.map((u) => [u.user_id, u]));
      const teamMap = new Map<number, TeamInfo>();
      rosters.forEach((r: SleeperRoster) => {
        const u = r.owner_id ? userMap.get(r.owner_id) : undefined;
        teamMap.set(r.roster_id, {
          rosterId:    r.roster_id,
          ownerId:     r.owner_id ?? "",
          displayName: u?.display_name ?? `Roster ${r.roster_id}`,
          teamName:    u?.metadata?.team_name ?? u?.display_name ?? `Team ${r.roster_id}`,
          avatar:      u?.avatar ?? null,
        });
      });
      setTeams(teamMap);

      const playoffStart = leagueData.settings?.playoff_week_start ?? 15;
      const lastScored   = leagueData.settings?.last_scored_leg ?? 0;
      const maxRegular   = playoffStart - 1;
      const weeksToFetch = Math.min(lastScored > 0 ? lastScored : maxRegular, maxRegular);

      if (weeksToFetch >= 1 && resolvedConfig) {
        const weekNums = Array.from({ length: weeksToFetch }, (_, i) => i + 1);

        const allMatchups = await Promise.all(
          weekNums.map((w) => getMatchups(leagueId, w).catch(() => []))
        );

        const adaptedLeague: ManualLeague = {
          id:   leagueId,
          name: leagueData.name,
          teams: Array.from(teamMap.values()).map((t) => ({
            id:   String(t.rosterId),
            name: t.teamName,
          })),
          config: {
            basePenalty: resolvedConfig.base_penalty,
            bottomScorersCount: resolvedConfig.bottom_scorers_count ?? 1,
            buyIn:       resolvedConfig.buy_in,
          },
          createdAt: resolvedConfig.created_at ?? "",
        };

        const weekEntries: WeekEntry[] = [];
        allMatchups.forEach((matchups, i) => {
          const entry = buildWeekEntry(weekNums[i], leagueId, matchups);
          if (entry) weekEntries.push(entry);
        });

        const seasonRecords = calculateSeasonTaxes(weekEntries, adaptedLeague);
        const taxMap = new Map<number, number>();
        seasonRecords.forEach(({ team, totalOwed }) => {
          taxMap.set(Number(team.id), totalOwed);
        });
        setTaxByRoster(taxMap);
        setSurgeTotal(totalPot(weekEntries, adaptedLeague));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [leagueId, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const startingPot = config ? config.buy_in * config.team_count : 0;
  const potTotal    = startingPot + surgeTotal;
  const champion    = championId != null ? teams.get(championId) ?? null : null;
  const champDebt   = championId != null ? (taxByRoster.get(championId) ?? 0) : 0;
  const champPrize  = potTotal - champDebt;

  const payouts = useMemo(() =>
    Array.from(teams.values())
      .filter((t) => t.rosterId !== championId)
      .map((t) => ({ team: t, owes: taxByRoster.get(t.rosterId) ?? 0 }))
      .sort((a, b) => b.owes - a.owes || a.team.teamName.localeCompare(b.team.teamName)),
    [teams, championId, taxByRoster]
  );

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-7 h-7 border-2 border-white/6 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-slate-600 text-sm">Calculating payouts…</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-sm w-full text-center">
          <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 flex items-center gap-1.5 mx-auto text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-12">

      {/* Inline page header */}
      <div className="w-full max-w-2xl mx-auto px-4 pt-5 pb-4 flex items-center gap-3 border-b border-white/6">
        <button
          onClick={() => router.back()}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Payouts</p>
          <p className="text-xs text-slate-600 truncate">{league?.name}</p>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 space-y-4 mt-1">

        {/* ── Champion card ── */}
        {champion ? (
          <div
            className="border border-amber-500/20 rounded-2xl overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 70%)" }}
          >
            {/* Label row */}
            <div className="flex items-center gap-2 px-5 pt-5 pb-2">
              <Trophy className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
              <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">
                {league?.season} Champion
              </p>
            </div>

            {/* Champion identity */}
            <div className="flex items-center gap-3 px-5 pb-4">
              <Avatar
                src={avatarUrl(champion.avatar)}
                name={champion.displayName}
                size="lg"
                className="border-2 border-amber-500/25"
              />
              <div>
                <p className="text-2xl font-bold text-white">{champion.teamName}</p>
                <p className="text-sm text-slate-500">{champion.displayName}</p>
              </div>
            </div>

            {/* Prize breakdown */}
            <div className="border-t border-white/6 px-5 py-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Pot</p>
                <p className="text-2xl font-bold text-white tabular-nums">${potTotal.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Own debt</p>
                <p className="text-2xl font-bold text-red-400 tabular-nums">
                  {champDebt > 0 ? `-$${champDebt.toLocaleString()}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Receives</p>
                <p className="text-2xl font-bold text-emerald-400 tabular-nums">${champPrize.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#0d1420] border border-white/6 rounded-2xl p-6 text-center">
            <Trophy className="w-7 h-7 text-slate-700 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-slate-500 font-medium">Champion not determined</p>
            <p className="text-xs text-slate-700 mt-1">Check back when the season is complete</p>
          </div>
        )}

        {/* ── Pot summary ── */}
        <div className="bg-[#0d1420] border border-white/6 rounded-2xl px-5 py-4 space-y-2.5">
          <p className="text-xs text-slate-500 uppercase tracking-widest">Pot breakdown</p>
          {startingPot > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Starting pot</span>
              <span className="font-bold text-white tabular-nums">${startingPot.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Surge penalties</span>
            <span className="font-bold text-white tabular-nums">${surgeTotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2.5 border-t border-white/6">
            <span className="font-semibold text-white">Total pot</span>
            <span className="font-bold text-white tabular-nums">${potTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* ── Who owes what ── */}
        <section>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 px-1">
            Who owes what
          </p>
          <div className="bg-[#0d1420] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/6">
            {payouts.map(({ team, owes }) => (
              <div key={team.rosterId} className="flex items-center gap-3 px-4 py-4 hover:bg-white/3 transition-colors">
                <Avatar src={avatarUrl(team.avatar)} name={team.displayName} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{team.teamName}</p>
                  {owes > 0 && champion ? (
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      owes{" "}
                      <span className="text-slate-400">{champion.teamName}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
                      No tax owed
                    </p>
                  )}
                </div>
                {owes > 0 ? (
                  <span className="text-red-400 font-bold text-sm flex-shrink-0 tabular-nums">
                    ${owes.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-slate-600 text-sm flex-shrink-0">—</span>
                )}
              </div>
            ))}

            {/* Champion's own row if they owed */}
            {champion && champDebt > 0 && (
              <div className="flex items-center gap-3 px-4 py-4 bg-amber-500/5 hover:bg-amber-500/8 transition-colors">
                <Avatar
                  src={avatarUrl(champion.avatar)}
                  name={champion.displayName}
                  className="border border-amber-500/25"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{champion.teamName}</p>
                    <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      Champ
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">Deducted from prize</p>
                </div>
                <span className="text-amber-400/70 font-bold text-sm flex-shrink-0 tabular-nums">
                  −${champDebt.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── Rules note ── */}
        <div className="bg-[#0d1420] border border-white/6 rounded-2xl px-5 py-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2.5">
            How it works
          </p>
          <ul className="space-y-1.5 text-xs text-slate-500 leading-relaxed">
            <li>
              Bottom <span className="text-slate-300">{config?.bottom_scorers_count ?? 1}</span>{" "}
              scorer{(config?.bottom_scorers_count ?? 1) > 1 ? "s" : ""} each week owe{" "}
              <span className="text-slate-300">${(config?.base_penalty ?? 25).toLocaleString()}</span> to the pot
            </li>
            <li>League champion collects the entire pot at season end</li>
            <li>Champion&apos;s own taxes are deducted from their prize</li>
          </ul>
        </div>

      </div>
    </main>
  );
}
