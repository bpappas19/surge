"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getMatchups,
  avatarUrl,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperRoster,
} from "@/lib/sleeper";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingDown,
  Trophy,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const TAX = 25;

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeamInfo {
  rosterId: number;
  ownerId: string;
  displayName: string;
  teamName: string;
  avatar: string | null;
}

interface WeekResult {
  week: number;
  lowestRosterId: number;
  lowestPts: number;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Avatar({
  src,
  name,
  size = "md",
  ring = false,
}: {
  src?: string;
  name: string;
  size?: "sm" | "md";
  ring?: boolean;
}) {
  const dim = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  const ringCls = ring ? "ring-2 ring-green-400/30" : "";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={`${dim} ${ringCls} rounded-full object-cover flex-shrink-0`} />
    );
  }
  return (
    <div className={`${dim} ${ringCls} rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 font-bold text-slate-400`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function PotCard({ total, weeks }: { total: number; weeks: number }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent border border-green-500/30 rounded-2xl p-5">
      {/* Decorative glow */}
      <div className="absolute -top-6 -right-6 w-32 h-32 bg-green-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-1">
            Total Pot
          </p>
          <p className="text-5xl font-black text-white tabular-nums">
            ${total.toLocaleString()}
          </p>
          <p className="text-sm text-slate-400 mt-2">
            {weeks} week{weeks !== 1 ? "s" : ""} · $25 per lowest scorer
          </p>
        </div>
        <div className="bg-green-500/20 rounded-xl p-3 flex-shrink-0">
          <DollarSign className="w-6 h-6 text-green-400" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LeagueDashboard() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  const [league, setLeague]           = useState<SleeperLeague | null>(null);
  const [teams, setTeams]             = useState<Map<number, TeamInfo>>(new Map());
  const [weekResults, setWeekResults] = useState<WeekResult[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMsg, setLoadingMsg]   = useState("Loading league…");
  const [error, setError]             = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setLoadingMsg("Loading league…");

      // ── 1. Fetch core data in parallel ──
      const [leagueData, rosters, users] = await Promise.all([
        getLeague(leagueId),
        getLeagueRosters(leagueId),
        getLeagueUsers(leagueId),
      ]);
      setLeague(leagueData);

      // ── 2. Build team map ──
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

      // ── 3. Determine regular-season week range ──
      const playoffStart = leagueData.settings?.playoff_week_start ?? 15;
      const lastScored   = leagueData.settings?.last_scored_leg ?? 0;
      const maxRegular   = playoffStart - 1;
      const weeksToFetch = Math.min(lastScored > 0 ? lastScored : maxRegular, maxRegular);

      if (weeksToFetch < 1) {
        setLoading(false);
        return;
      }

      // ── 4. Fetch all weeks in parallel ──
      setLoadingMsg(`Loading ${weeksToFetch} weeks of matchups…`);

      const weekNums = Array.from({ length: weeksToFetch }, (_, i) => i + 1);
      const allMatchups = await Promise.all(
        weekNums.map((w) => getMatchups(leagueId, w).catch(() => []))
      );

      const results: WeekResult[] = [];
      allMatchups.forEach((matchups, i) => {
        const week = weekNums[i];
        if (!matchups.length) return;
        const valid = matchups.filter((m) => m.points > 0);
        if (!valid.length) return;
        const lowest = valid.reduce((min, m) => (m.points < min.points ? m : min));
        results.push({ week, lowestRosterId: lowest.roster_id, lowestPts: lowest.points });
      });

      setWeekResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load league.");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived: per-team taxes ──
  const teamTaxes = useMemo(() => {
    const map = new Map<number, { info: TeamInfo; owed: number; weeks: number[] }>();
    teams.forEach((info, id) => map.set(id, { info, owed: 0, weeks: [] }));
    weekResults.forEach(({ lowestRosterId, week }) => {
      const t = map.get(lowestRosterId);
      if (t) { t.owed += TAX; t.weeks.push(week); }
    });
    return Array.from(map.values()).sort((a, b) => b.owed - a.owed || a.info.teamName.localeCompare(b.info.teamName));
  }, [teams, weekResults]);

  const potTotal = weekResults.length * TAX;

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center gap-5">
        <Logo size="md" />
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">{loadingMsg}</p>
        </div>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center gap-4 px-4">
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-6 max-w-sm w-full text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 text-sm leading-relaxed">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 flex items-center gap-1.5 mx-auto text-sm text-green-400 hover:text-green-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#080810] pb-10">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 bg-[#080810]/90 backdrop-blur-md border-b border-[#1c1c30] px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="text-slate-500 hover:text-white transition-colors p-1 -ml-1 rounded-lg"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-sm leading-tight truncate">
              {league?.name ?? "League"}
            </h1>
            <p className="text-xs text-slate-600">
              {league?.season} · {league?.total_rosters} teams
            </p>
          </div>
          <Logo size="xs" />
        </div>
      </header>

      <div className="px-4 max-w-2xl mx-auto mt-5 space-y-5">

        {/* ── Pot total card ── */}
        <PotCard total={potTotal} weeks={weekResults.length} />

        {/* ── Payouts CTA (season complete) ── */}
        {league?.status === "complete" && (
          <Link
            href={`/league/${leagueId}/payouts`}
            className="flex items-center gap-3 bg-[#111120] border border-[#1c1c30] hover:border-yellow-500/40 hover:bg-[#18182a] active:scale-[0.98] rounded-2xl px-4 py-4 transition-all group"
          >
            <div className="bg-yellow-500/15 rounded-xl p-2.5 flex-shrink-0">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">Season complete — view payouts</p>
              <p className="text-xs text-slate-500 mt-0.5">See exactly who owes the champion</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-yellow-400 transition-colors" />
          </Link>
        )}

        {/* ── Tax standings ── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3 px-1">
            Tax standings
          </h2>
          <div className="bg-[#111120] border border-[#1c1c30] rounded-2xl overflow-hidden divide-y divide-[#1c1c30]">
            {teamTaxes.length === 0 ? (
              <p className="px-4 py-8 text-center text-slate-600 text-sm">
                No matchup data yet
              </p>
            ) : (
              teamTaxes.map(({ info, owed, weeks }) => (
                <div key={info.rosterId} className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar src={avatarUrl(info.avatar)} name={info.displayName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug truncate">
                      {info.teamName}
                    </p>
                    <p className="text-xs text-slate-600 truncate">{info.displayName}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {owed > 0 ? (
                      <>
                        <p className="text-sm font-bold text-red-400">−${owed}</p>
                        <p className="text-[10px] text-slate-700 mt-0.5">
                          Wk {weeks.join(", ")}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-slate-600">$0</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Weekly recap ── */}
        {weekResults.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3 px-1">
              Weekly recap
            </h2>
            <div className="bg-[#111120] border border-[#1c1c30] rounded-2xl overflow-hidden divide-y divide-[#1c1c30]">
              {weekResults.map(({ week, lowestRosterId, lowestPts }) => {
                const team = teams.get(lowestRosterId);
                return (
                  <div key={week} className="flex items-center gap-3 px-4 py-3">
                    {/* Week chip */}
                    <div className="w-9 h-9 rounded-lg bg-[#1c1c30] flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-slate-600 uppercase leading-none">WK</span>
                      <span className="text-sm font-black text-slate-400 leading-tight">{week}</span>
                    </div>

                    {/* Avatar + name */}
                    <Avatar src={avatarUrl(team?.avatar)} name={team?.teamName ?? "?"} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {team?.teamName ?? `Roster ${lowestRosterId}`}
                      </p>
                      <p className="text-xs text-slate-600">
                        {lowestPts.toFixed(2)} pts · lowest scorer
                      </p>
                    </div>

                    {/* Tax badge */}
                    <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 flex-shrink-0">
                      <TrendingDown className="w-3 h-3 text-red-400" />
                      <span className="text-red-400 text-xs font-bold">$25</span>
                    </div>
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
