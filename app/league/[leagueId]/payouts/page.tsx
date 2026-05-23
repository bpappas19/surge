"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Logo from "@/components/Logo";
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
} from "@/lib/sleeper";
import {
  ChevronLeft,
  Trophy,
  DollarSign,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
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
}

// ─── Avatar helper ──────────────────────────────────────────────────────────

function Avatar({
  src,
  name,
  size = "md",
  border = "",
}: {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  border?: string;
}) {
  const dim = { sm: "w-9 h-9 text-sm", md: "w-11 h-11 text-sm", lg: "w-14 h-14 text-lg" }[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={`${dim} ${border} rounded-full object-cover flex-shrink-0`} />
    );
  }
  return (
    <div className={`${dim} ${border} rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 font-bold text-slate-400`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PayoutsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();

  const [league, setLeague]               = useState<SleeperLeague | null>(null);
  const [teams, setTeams]                 = useState<Map<number, TeamInfo>>(new Map());
  const [weekResults, setWeekResults]     = useState<WeekResult[]>([]);
  const [championId, setChampionId]       = useState<number | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [leagueData, rosters, users, bracket] = await Promise.all([
        getLeague(leagueId),
        getLeagueRosters(leagueId),
        getLeagueUsers(leagueId),
        getWinnersBracket(leagueId).catch(() => []),
      ]);

      setLeague(leagueData);

      // Build maps
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

      // Champion
      setChampionId(findChampionRosterId(bracket));

      // Fetch regular-season weeks
      const playoffStart = leagueData.settings?.playoff_week_start ?? 15;
      const lastScored   = leagueData.settings?.last_scored_leg ?? 0;
      const maxRegular   = playoffStart - 1;
      const weeksToFetch = Math.min(lastScored > 0 ? lastScored : maxRegular, maxRegular);

      if (weeksToFetch >= 1) {
        const weekNums    = Array.from({ length: weeksToFetch }, (_, i) => i + 1);
        const allMatchups = await Promise.all(
          weekNums.map((w) => getMatchups(leagueId, w).catch(() => []))
        );
        const results: WeekResult[] = [];
        allMatchups.forEach((matchups, i) => {
          const week  = weekNums[i];
          const valid = matchups.filter((m) => m.points > 0);
          if (!valid.length) return;
          const lowest = valid.reduce((min, m) => (m.points < min.points ? m : min));
          results.push({ week, lowestRosterId: lowest.roster_id });
        });
        setWeekResults(results);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const { taxByRoster, potTotal } = useMemo(() => {
    const m = new Map<number, number>();
    weekResults.forEach(({ lowestRosterId }) =>
      m.set(lowestRosterId, (m.get(lowestRosterId) ?? 0) + TAX)
    );
    return { taxByRoster: m, potTotal: weekResults.length * TAX };
  }, [weekResults]);

  const champion = championId != null ? teams.get(championId) ?? null : null;
  const champDebt   = championId != null ? (taxByRoster.get(championId) ?? 0) : 0;
  const champPrize  = potTotal - champDebt;

  const payouts = useMemo(() =>
    Array.from(teams.values())
      .filter((t) => t.rosterId !== championId)
      .map((t) => ({ team: t, owes: taxByRoster.get(t.rosterId) ?? 0 }))
      .sort((a, b) => b.owes - a.owes || a.team.teamName.localeCompare(b.team.teamName)),
    [teams, championId, taxByRoster]
  );

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center gap-5">
        <Logo size="md" />
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Calculating payouts…</p>
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
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={loadData} className="mt-4 flex items-center gap-1.5 mx-auto text-sm text-green-400 hover:text-green-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#080810] pb-10">

      {/* ── Header ── */}
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
            <h1 className="font-bold text-white text-sm truncate">Payouts</h1>
            <p className="text-xs text-slate-600 truncate">{league?.name}</p>
          </div>
          <Logo size="xs" />
        </div>
      </header>

      <div className="px-4 max-w-2xl mx-auto mt-5 space-y-5">

        {/* ── Champion card ── */}
        {champion ? (
          <div className="relative overflow-hidden bg-gradient-to-br from-yellow-500/20 via-yellow-500/10 to-transparent border border-yellow-500/30 rounded-2xl p-5">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-widest">
                  {league?.season} Champion
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Avatar
                  src={avatarUrl(champion.avatar)}
                  name={champion.displayName}
                  size="lg"
                  border="border-2 border-yellow-400/30"
                />
                <div>
                  <p className="text-xl font-black text-white leading-tight">{champion.teamName}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{champion.displayName}</p>
                </div>
              </div>

              {/* Prize breakdown */}
              <div className="mt-5 pt-4 border-t border-yellow-500/20 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Pot total</p>
                  <p className="text-xl font-black text-white">${potTotal}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Own debt</p>
                  <p className="text-xl font-black text-red-400">
                    {champDebt > 0 ? `−$${champDebt}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-green-500 uppercase tracking-wider mb-0.5">Net prize</p>
                  <p className="text-xl font-black text-green-400">${champPrize}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#111120] border border-[#1c1c30] rounded-2xl p-6 text-center">
            <Trophy className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">Champion not determined yet</p>
            <p className="text-slate-700 text-xs mt-1">Check back when the season is complete</p>
          </div>
        )}

        {/* ── Pot summary ── */}
        <div className="bg-[#111120] border border-[#1c1c30] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-semibold text-white">Pot breakdown</h2>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Weeks with a tax</span>
              <span className="font-semibold text-white">{weekResults.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Tax per week</span>
              <span className="font-semibold text-white">$25</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2.5 border-t border-[#1c1c30]">
              <span className="font-semibold text-white">Total pot</span>
              <span className="font-black text-green-400">${potTotal}</span>
            </div>
          </div>
        </div>

        {/* ── Who owes what ── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3 px-1">
            Who owes what
          </h2>

          <div className="bg-[#111120] border border-[#1c1c30] rounded-2xl overflow-hidden divide-y divide-[#1c1c30]">
            {payouts.map(({ team, owes }) => (
              <div key={team.rosterId} className="flex items-center gap-3 px-4 py-3.5">
                <Avatar src={avatarUrl(team.avatar)} name={team.displayName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{team.teamName}</p>
                  {owes > 0 && champion ? (
                    <p className="text-xs text-slate-600 mt-0.5">
                      owes{" "}
                      <span className="text-yellow-400 font-medium">{champion.teamName}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-green-500/70 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      No taxes owed
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {owes > 0 ? (
                    <span className="bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm px-3 py-1 rounded-lg">
                      ${owes}
                    </span>
                  ) : (
                    <span className="text-slate-700 text-sm font-semibold">$0</span>
                  )}
                </div>
              </div>
            ))}

            {/* Champion's own row (if they owed) */}
            {champion && champDebt > 0 && (
              <div className="flex items-center gap-3 px-4 py-3.5 bg-yellow-500/5">
                <Avatar
                  src={avatarUrl(champion.avatar)}
                  name={champion.displayName}
                  size="sm"
                  border="border border-yellow-400/30"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{champion.teamName}</p>
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">
                      Champ
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">Deducted from prize</p>
                </div>
                <span className="text-yellow-400/60 font-bold text-sm flex-shrink-0">
                  −${champDebt}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── How it works ── */}
        <div className="bg-[#111120] border border-[#1c1c30] rounded-2xl p-4">
          <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3">
            How it works
          </h2>
          <ul className="space-y-2 text-xs text-slate-500 leading-relaxed">
            <li>• Each week, the <span className="text-white">lowest scorer</span> owes <span className="text-white font-semibold">$25</span> to the pot</li>
            <li>• The <span className="text-white">league champion</span> collects the entire pot at season end</li>
            <li>• If the champion also owed taxes, that amount is deducted from their prize</li>
          </ul>
        </div>

      </div>
    </main>
  );
}
