"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getMatchups,
  getWeekPlayerStats,
  countPlayerTDs,
  avatarUrl,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperRoster,
  SleeperMatchup,
  SleeperPlayerStats,
} from "@/lib/sleeper";
import { getSleeperSettings } from "@/lib/storage";
import { getLeagueConfig, SleeperLeagueConfig } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import { getLeagueBySleeperLeagueId, getMember } from "@/lib/db";
import { calculateSeasonTaxes, calculateWeekTaxes, totalPot } from "@/lib/calc";
import type { ManualLeague, WeekEntry, MilestoneRule } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Trophy,
  AlertCircle,
  RefreshCw,
  Settings,
  Copy,
  CheckCircle2,
  Link2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

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
  matchups: SleeperMatchup[],
  milestones: MilestoneRule[],
  playerStats: Record<string, SleeperPlayerStats>
): WeekEntry | null {
  const valid = matchups.filter((m) => m.points > 0);
  if (!valid.length) return null;

  const lowest = valid.reduce((min, m) => (m.points < min.points ? m : min));

  const milestoneResults = milestones.map((rule) => {
    let qualifyingTeamIds: string[];
    if (rule.type === "points") {
      qualifyingTeamIds = valid
        .filter((m) => m.points >= rule.threshold)
        .map((m) => String(m.roster_id));
    } else {
      qualifyingTeamIds = valid
        .filter((m) =>
          m.starters.some(
            (playerId) => countPlayerTDs(playerStats[playerId]) >= rule.threshold
          )
        )
        .map((m) => String(m.roster_id));
    }
    return { qualifyingTeamIds };
  });

  return {
    leagueId,
    week,
    lowestScorerTeamId: String(lowest.roster_id),
    milestoneResults,
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
  size?: "sm" | "md";
  className?: string;
}) {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  const letter = name.charAt(0).toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${dim} ${className} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} ${className} rounded-full bg-navy-700 flex items-center justify-center flex-shrink-0 font-semibold text-slate-500`}
    >
      {letter}
    </div>
  );
}

// ─── CopyButton ────────────────────────────────────────────────────────────

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

// ─── Page ──────────────────────────────────────────────────────────────────

export default function LeagueDashboard() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [supabase] = useState(() => createClient());
  const [league,       setLeague]       = useState<SleeperLeague | null>(null);
  const [teams,        setTeams]        = useState<Map<number, TeamInfo>>(new Map());
  const [config,       setConfig]       = useState<SleeperLeagueConfig | null>(null);
  const [weekEntries,  setWeekEntries]  = useState<WeekEntry[]>([]);
  const [weekLowPts,   setWeekLowPts]   = useState<Map<number, number>>(new Map());
  const [loading,      setLoading]      = useState(true);
  const [loadingMsg,   setLoadingMsg]   = useState("Loading league…");
  const [error,        setError]        = useState("");
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [leagueRowId,    setLeagueRowId]    = useState<string | null>(null);

  const inviteUrl = useMemo(() => {
    if (!isCommissioner || !leagueRowId || typeof window === "undefined") return null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    return `${appUrl}/join/${leagueRowId}`;
  }, [isCommissioner, leagueRowId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setLoadingMsg("Loading league…");

      // Fetch Sleeper data + leagues table in parallel
      const [leagueData, rosters, users, leagueRow, legacyConfig] = await Promise.all([
        getLeague(leagueId),
        getLeagueRosters(leagueId),
        getLeagueUsers(leagueId),
        getLeagueBySleeperLeagueId(supabase, leagueId).catch(() => null),
        getLeagueConfig(leagueId).catch(() => null),
      ]);

      setLeague(leagueData);

      // Determine config priority: leagues table → legacy Supabase → localStorage → setup
      let resolvedConfig: SleeperLeagueConfig | null = null;
      if (leagueRow) {
        resolvedConfig = {
          league_id:    leagueId,
          season:       leagueRow.season,
          buy_in:       leagueRow.buy_in,
          team_count:   leagueRow.team_count,
          base_penalty: leagueRow.base_penalty,
          milestones:   (leagueRow.milestones ?? []) as MilestoneRule[],
          created_at:   leagueRow.created_at,
        };
        setLeagueRowId(leagueRow.id);

        // Check role membership
        if (user) {
          const membership = await getMember(supabase, leagueRow.id, user.id);
          setIsCommissioner(membership?.role === "commissioner");
        }
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
            milestones:   [],
          };
        } else {
          router.replace(`/league/${leagueId}/setup`);
          return;
        }
      }
      setConfig(resolvedConfig);

      // Build team map
      const userMap = new Map<string, SleeperLeagueUser>(
        users.map((u) => [u.user_id, u])
      );
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

      // Determine regular-season weeks
      const playoffStart = leagueData.settings?.playoff_week_start ?? 15;
      const lastScored   = leagueData.settings?.last_scored_leg ?? 0;
      const maxRegular   = playoffStart - 1;
      const weeksToFetch = Math.min(lastScored > 0 ? lastScored : maxRegular, maxRegular);
      if (weeksToFetch < 1) { setLoading(false); return; }

      setLoadingMsg(`Loading ${weeksToFetch} weeks…`);

      const weekNums       = Array.from({ length: weeksToFetch }, (_, i) => i + 1);
      const hasTDMilestone = resolvedConfig.milestones.some((m) => m.type === "touchdowns");

      const [allMatchups, allPlayerStats] = await Promise.all([
        Promise.all(weekNums.map((w) => getMatchups(leagueId, w).catch(() => []))),
        hasTDMilestone
          ? Promise.all(
              weekNums.map((w) =>
                getWeekPlayerStats(leagueData.season, w).catch(
                  (): Record<string, SleeperPlayerStats> => ({})
                )
              )
            )
          : Promise.resolve(
              weekNums.map((): Record<string, SleeperPlayerStats> => ({}))
            ),
      ]);

      const entries: WeekEntry[]      = [];
      const lowPtsMap                  = new Map<number, number>();

      allMatchups.forEach((matchups, i) => {
        const valid = matchups.filter((m) => m.points > 0);
        if (!valid.length) return;
        const lowest = valid.reduce((min, m) => (m.points < min.points ? m : min));
        lowPtsMap.set(weekNums[i], lowest.points);

        const entry = buildWeekEntry(
          weekNums[i],
          leagueId,
          matchups,
          resolvedConfig!.milestones,
          allPlayerStats[i]
        );
        if (entry) entries.push(entry);
      });

      setWeekEntries(entries);
      setWeekLowPts(lowPtsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load league.");
    } finally {
      setLoading(false);
    }
  }, [leagueId, router, supabase, user]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ────────────────────────────────────────────────────────

  const adaptedLeague = useMemo<ManualLeague | null>(() => {
    if (!config || teams.size === 0) return null;
    return {
      id:    leagueId,
      name:  league?.name ?? "",
      teams: Array.from(teams.values()).map((t) => ({
        id:   String(t.rosterId),
        name: t.teamName,
      })),
      config: {
        basePenalty: config.base_penalty,
        milestones:  config.milestones,
        buyIn:       config.buy_in,
      },
      createdAt: config.created_at ?? "",
    };
  }, [config, teams, leagueId, league]);

  const seasonRecords = useMemo(
    () =>
      adaptedLeague && weekEntries.length > 0
        ? calculateSeasonTaxes(weekEntries, adaptedLeague)
        : [],
    [adaptedLeague, weekEntries]
  );

  const surgeTotal = useMemo(
    () => (adaptedLeague ? totalPot(weekEntries, adaptedLeague) : 0),
    [adaptedLeague, weekEntries]
  );

  // Write surge total back to leagues.surge_deposit so the /leagues page can
  // display the correct pot without needing to call the Sleeper API itself.
  // Fire-and-forget; runs once after the week data is fully computed.
  useEffect(() => {
    if (!leagueRowId || weekEntries.length === 0) return;
    supabase
      .from("leagues")
      .update({ surge_deposit: surgeTotal })
      .eq("id", leagueRowId)
      .then();
  }, [leagueRowId, surgeTotal, supabase]);

  const startingPot = config ? config.buy_in * config.team_count : 0;

  function teamById(id: string): TeamInfo | undefined {
    return teams.get(Number(id));
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-7 h-7 border-2 border-navy-700 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-slate-600 text-sm">{loadingMsg}</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-sm w-full text-center">
          <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-red-400 text-sm leading-relaxed">{error}</p>
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-12">

      {/* Inline page header */}
      <div className="w-full max-w-2xl mx-auto px-4 pt-5 pb-4 flex items-center gap-3 border-b border-navy-700/50">
        <button
          onClick={() => router.back()}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-100 truncate">
              {league?.name ?? "League"}
            </p>
            {isCommissioner && (
              <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded px-1.5 py-0.5">
                Commissioner
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">
            {league?.season} · {league?.total_rosters} teams
          </p>
        </div>

        {/* Invite link — commissioner only */}
        {isCommissioner && inviteUrl && (
          <div className="flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" strokeWidth={1.5} />
            <CopyButton text={inviteUrl} />
          </div>
        )}

        {/* Settings — commissioner only */}
        {isCommissioner && (
          <Link
            href={`/league/${leagueId}/edit`}
            className="text-slate-600 hover:text-slate-300 transition-colors p-1"
            title="Edit league settings"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        )}
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 space-y-4 mt-1">

        {/* ── Pot total ── */}
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-1">
            Total pot
          </p>
          {startingPot > 0 ? (
            <>
              <p className="text-5xl font-bold text-slate-100 tabular-nums">
                ${(startingPot + surgeTotal).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                <span className="text-slate-400 tabular-nums">
                  ${startingPot.toLocaleString()}
                </span>
                {" starting pot"}
                {surgeTotal > 0 && (
                  <>
                    {" + "}
                    <span className="text-slate-400 tabular-nums">
                      ${surgeTotal.toLocaleString()}
                    </span>
                    {" in surges"}
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="text-5xl font-bold text-slate-100 tabular-nums">
                ${surgeTotal.toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 mt-1.5">
                {weekEntries.length} week{weekEntries.length !== 1 ? "s" : ""}{" "}
                · ${config?.base_penalty ?? 25} base penalty
              </p>
            </>
          )}
        </div>

        {/* ── Season payouts CTA ── */}
        {league?.status === "complete" && (
          <Link
            href={`/league/${leagueId}/payouts`}
            className="group flex items-center gap-3 bg-amber-500/8 border border-amber-500/20 hover:border-amber-500/35 hover:bg-amber-500/12 rounded-xl px-4 py-3.5 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">Season complete</p>
              <p className="text-xs text-slate-600 mt-0.5">View final payouts</p>
            </div>
            <ChevronRight
              className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors"
              strokeWidth={1.5}
            />
          </Link>
        )}

        {/* ── Tax standings ── */}
        <section>
          <p className="text-xs font-medium text-slate-600 mb-2 px-1">
            Tax standings
          </p>
          <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden divide-y divide-navy-700">
            {seasonRecords.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-600">
                No matchup data yet
              </p>
            ) : (
              seasonRecords.map(({ team, totalOwed, weekBreakdown }) => {
                const info = teamById(team.id);
                return (
                  <div key={team.id} className="flex items-center gap-3 px-4 py-4">
                    <Avatar src={avatarUrl(info?.avatar)} name={team.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">
                        {team.name}
                      </p>
                      {info && (
                        <p className="text-xs text-slate-600 truncate">
                          {info.displayName}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {totalOwed > 0 ? (
                        <>
                          <p className="text-sm font-bold text-red-400 tabular-nums">
                            −${totalOwed}
                          </p>
                          <p className="text-[10px] text-slate-700 mt-0.5 tabular-nums">
                            Wk{" "}
                            {[...new Set(weekBreakdown.map((w) => w.week))].join(", ")}
                          </p>
                        </>
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

        {/* ── Weekly recap ── */}
        {weekEntries.length > 0 && adaptedLeague && (
          <section>
            <p className="text-xs font-medium text-slate-600 mb-2 px-1">
              Weekly recap
            </p>
            <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden divide-y divide-navy-700">
              {weekEntries.map((entry) => {
                const lowestTeam = teamById(entry.lowestScorerTeamId);
                const pts        = weekLowPts.get(entry.week);
                const charges    = calculateWeekTaxes(entry, adaptedLeague);
                const weekTotal  = charges.reduce((s, c) => s + c.amount, 0);

                const milestonesFired = (config?.milestones ?? [])
                  .map((rule, i) => ({
                    rule,
                    qualifiers: entry.milestoneResults[i]?.qualifyingTeamIds ?? [],
                  }))
                  .filter((m) => m.qualifiers.length > 0);

                return (
                  <div key={entry.week} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-navy-700 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-semibold text-slate-600 uppercase leading-none">
                          Wk
                        </span>
                        <span className="text-sm font-bold text-slate-400 tabular-nums leading-tight">
                          {entry.week}
                        </span>
                      </div>
                      <Avatar
                        src={avatarUrl(lowestTeam?.avatar)}
                        name={lowestTeam?.teamName ?? "?"}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">
                          {lowestTeam?.teamName ?? `Roster ${entry.lowestScorerTeamId}`}
                        </p>
                        <p className="text-xs text-slate-600 tabular-nums">
                          {pts != null ? `${pts.toFixed(2)} pts · ` : ""}lowest scorer
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-red-400 tabular-nums">
                          ${weekTotal}
                        </span>
                      </div>
                    </div>

                    {milestonesFired.length > 0 && (
                      <div className="mt-2 ml-11 space-y-1">
                        {milestonesFired.map(({ rule, qualifiers }, i) => (
                          <p key={i} className="text-[11px] text-emerald-500/70 leading-snug">
                            ⚡{" "}
                            {rule.type === "points"
                              ? `${rule.threshold}+ pts`
                              : `${rule.threshold}+ TDs`}
                            {" — "}
                            {qualifiers
                              .map((id) => teamById(id)?.teamName ?? `Roster ${id}`)
                              .join(", ")}
                            {" qualified"}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
