"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser, getUserLeagues, avatarUrl, SleeperLeague } from "@/lib/sleeper";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/contexts/AuthContext";
import { getLeagueBySleeperLeagueId, getMember } from "@/lib/db";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  AlertCircle,
  Users,
  Moon,
  Calendar,
} from "lucide-react";

// ─── Input class ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-navy-900 border border-navy-700 focus:border-teal-500/40 " +
  "rounded-lg px-3.5 py-2.5 text-sm " +
  "text-slate-100 placeholder:text-slate-600 outline-none transition-colors";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    complete:  { label: "Complete",  cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
    in_season: { label: "Live",      cls: "text-amber-400  bg-amber-500/10  border-amber-500/25" },
    drafting:  { label: "Drafting",  cls: "text-sky-400    bg-sky-500/10    border-sky-500/25" },
    pre_draft: { label: "Pre-draft", cls: "text-slate-400  bg-slate-500/10  border-slate-500/25" },
  };
  const s = map[status] ?? { label: status, cls: "text-slate-400 bg-slate-500/10 border-slate-500/25" };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── League row ───────────────────────────────────────────────────────────────

function LeagueRow({ league, onClick }: { league: SleeperLeague; onClick: () => void }) {
  const img = avatarUrl(league.avatar);
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-3 px-4 py-3.5 hover:bg-navy-750 active:bg-navy-700 transition-colors text-left"
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={league.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-navy-700 flex items-center justify-center flex-shrink-0">
          <Moon className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-100 truncate">{league.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Users className="w-3 h-3" strokeWidth={1.5} />
            {league.total_rosters}
          </span>
          <span className="text-navy-600">·</span>
          <span className="text-xs text-slate-500">{league.season}</span>
          <StatusBadge status={league.status} />
        </div>
      </div>
      <ChevronRight
        className="w-4 h-4 text-slate-700 group-hover:text-slate-400 flex-shrink-0 transition-colors"
        strokeWidth={1.5}
      />
    </button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SleeperPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [supabase] = useState(() => createClient());

  // Dynamically compute the last 3 seasons — updates automatically each year
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const [username,     setUsername]     = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [leagues,      setLeagues]      = useState<SleeperLeague[] | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = username.trim().toLowerCase();
    if (!q) return;

    setLoading(true);
    setError("");
    setLeagues(null);

    try {
      const sleeperUser = await getUser(q);
      const data = await getUserLeagues(sleeperUser.user_id, String(selectedYear));
      setLeagues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLeagueClick(league: SleeperLeague) {
    // Check if this specific season's league exists in our DB
    const leagueRow = await getLeagueBySleeperLeagueId(
      supabase,
      league.league_id,
      league.season
    ).catch(() => null);

    if (!leagueRow) {
      // No Surge config yet — go to setup
      router.push(`/league/${league.league_id}/setup`);
      return;
    }

    // League exists — check user membership
    if (user) {
      const membership = await getMember(supabase, leagueRow.id, user.id).catch(() => null);
      if (membership) {
        // Already a member → go to dashboard
        router.push(`/league/${league.league_id}`);
        return;
      }
    }

    // League exists but user is not a member → invite join flow
    router.push(`/join/${leagueRow.id}`);
  }

  return (
    <main
      className="bg-navy-950 flex flex-col items-center px-4 pb-12 pt-[12vh]"
      style={{ minHeight: "calc(100vh - 56px)" }}
    >

      <div className="w-full max-w-[520px] sm:max-w-[620px] lg:max-w-[720px] bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-start gap-3 px-8 pt-7 pb-5 lg:px-10 lg:pt-9 lg:pb-7 border-b border-navy-700">
          <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0 mt-0.5">
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
          </Link>
          <div>
            <p className="text-sm lg:text-base font-semibold text-slate-100">Connect Sleeper</p>
            <p className="text-xs lg:text-sm text-slate-500 mt-1 leading-relaxed">
              Enter your Sleeper username to automatically sync your league
            </p>
          </div>
        </div>

        {/* Search form */}
        <div className="px-8 py-7 lg:px-10 lg:py-9">
          <form onSubmit={handleSearch} className="space-y-3">

            {/* Season year selector */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" strokeWidth={1.5} />
                Season year
              </label>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setLeagues(null); // clear results when year changes
                  }}
                  className={`${inputCls} pr-9 appearance-none cursor-pointer`}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}{y === currentYear ? " (current)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            {/* Username input */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">
                Sleeper username
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. sleeperjoe"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`${inputCls} pl-10`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Searching…
                </>
              ) : (
                `Find ${selectedYear} leagues`
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* League list */}
        {leagues !== null && (
          leagues.length === 0 ? (
            <div className="border-t border-navy-700 px-5 py-8 text-center">
              <p className="text-sm text-slate-500">
                No {selectedYear} NFL leagues found for this username.
              </p>
            </div>
          ) : (
            <div className="border-t border-navy-700">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wider px-5 pt-4 pb-2">
                {leagues.length} league{leagues.length !== 1 ? "s" : ""} · {selectedYear} season
              </p>
              <div className="divide-y divide-navy-700">
                {leagues.map((league) => (
                  <LeagueRow
                    key={league.league_id}
                    league={league}
                    onClick={() => handleLeagueClick(league)}
                  />
                ))}
              </div>
            </div>
          )
        )}

      </div>

      <p className="text-xs text-slate-700 text-center mt-4">
        Your Sleeper data is read-only and never stored.
      </p>
    </main>
  );
}
