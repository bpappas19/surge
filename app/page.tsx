"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ChevronRight, Users, Search, AlertCircle } from "lucide-react";
import Logo from "@/components/Logo";
import { getUser, getUserLeagues, avatarUrl, SleeperLeague } from "@/lib/sleeper";

// ─── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    complete:  { label: "Complete",   cls: "text-green-400 bg-green-400/10 border-green-400/20" },
    in_season: { label: "Live",       cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    drafting:  { label: "Drafting",   cls: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    pre_draft: { label: "Pre-draft",  cls: "text-slate-400 bg-slate-400/10 border-slate-400/20" },
  };
  const s = map[status] ?? { label: status, cls: "text-slate-400 bg-slate-400/10 border-slate-400/20" };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── League card ────────────────────────────────────────────────────────────

function LeagueCard({ league, onClick }: { league: SleeperLeague; onClick: () => void }) {
  const img = avatarUrl(league.avatar);
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-[#111120] border border-[#1c1c30] hover:border-green-500/40 hover:bg-[#141428] active:scale-[0.98] rounded-2xl px-4 py-4 transition-all duration-150 group text-left"
    >
      {/* Avatar */}
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={league.name} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-green-400" fill="currentColor" strokeWidth={0} />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm leading-snug truncate">{league.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Users className="w-3 h-3" />
            {league.total_rosters}
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-slate-500">{league.season}</span>
          <StatusBadge status={league.status} />
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-green-400 transition-colors flex-shrink-0" />
    </button>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [leagues, setLeagues]   = useState<SleeperLeague[] | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = username.trim().toLowerCase();
    if (!q) return;

    setLoading(true);
    setError("");
    setLeagues(null);

    try {
      const user = await getUser(q);
      const data = await getUserLeagues(user.user_id, "2025");
      setLeagues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#080810]">

      {/* ── Hero ── */}
      <div className="flex flex-col items-center justify-center pt-16 pb-10 px-4">
        {/* Glow blob behind logo */}
        <div className="absolute top-16 w-64 h-64 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

        <Logo size="lg" />

        <p className="mt-4 text-slate-400 text-center text-sm max-w-xs leading-relaxed">
          The lowest scorer every week owes <span className="text-white font-semibold">$25</span>.
          The champion takes it all.
        </p>
      </div>

      {/* ── Search form ── */}
      <div className="w-full max-w-md mx-auto px-4 relative">
        <form onSubmit={handleSearch} className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your Sleeper username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-[#111120] border border-[#1c1c30] focus:border-green-500 focus:ring-2 focus:ring-green-500/20 rounded-xl pl-10 pr-4 py-3.5 text-white text-sm placeholder:text-slate-600 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl py-3.5 text-sm transition-all select-none"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Finding leagues…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" fill="currentColor" strokeWidth={0} />
                Track My League
              </>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm leading-snug">{error}</p>
          </div>
        )}
      </div>

      {/* ── League list ── */}
      {leagues !== null && (
        <div className="w-full max-w-md mx-auto px-4 mt-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">
            {leagues.length > 0
              ? `${leagues.length} league${leagues.length !== 1 ? "s" : ""} found`
              : "No leagues found"}
          </p>

          {leagues.length === 0 ? (
            <div className="text-center py-10 text-slate-600 text-sm">
              No 2025 NFL leagues for this username.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {leagues.map((league) => (
                <LeagueCard
                  key={league.league_id}
                  league={league}
                  onClick={() => router.push(`/league/${league.league_id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-auto pt-12 pb-6 text-center">
        <p className="text-xs text-slate-800">Powered by Sleeper API · Surge v0.1</p>
      </div>
    </main>
  );
}
