"use client";

// ─── Bottom-scorers pill selector ─────────────────────────────────────────────

function teamLabel(n: number) {
  return `${n} team${n === 1 ? "" : "s"}`;
}

function buildBottomScorerOptions(teamCount: number): { label: string; count: number }[] {
  const n = Math.max(teamCount, 1);
  const options: { label: string; count: number }[] = [];

  const add = (label: string, count: number) => {
    if (count < 1 || count > n) return;
    options.push({ label, count });
  };

  add("1", 1);
  if (n >= 4) add("2", 2);
  if (n >= 6) add("3", 3);

  add(`Bottom 25% (${teamLabel(Math.floor(n * 0.25))})`, Math.floor(n * 0.25));
  add(`Bottom half (${teamLabel(Math.floor(n / 2))})`, Math.floor(n / 2));
  add(`All but top 2 (${teamLabel(n - 2)})`, n - 2);
  add(`All but winner (${teamLabel(n - 1)})`, n - 1);

  return options;
}

export function BottomScorersSelector({
  value, onChange, teamCount,
}: {
  value: number; onChange: (v: number) => void; teamCount: number;
}) {
  const options = buildBottomScorerOptions(teamCount);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.count)}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
            value === opt.count
              ? "bg-white/8 border-emerald-500/60 text-white shadow-[0_0_10px_rgba(16,185,129,0.15)]"
              : "bg-[#0d1420] border-white/8 text-slate-400 hover:text-slate-200 hover:border-white/20"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Live "how your pot grows" preview ────────────────────────────────────────

export function PotGrowthPreview({
  bottomScorersCount, basePenalty, totalWeeks,
}: {
  bottomScorersCount: number; basePenalty: number; totalWeeks: number;
}) {
  const perWeek = bottomScorersCount * basePenalty;
  const seasonTotal = perWeek * totalWeeks;
  return (
    <div
      className="border border-emerald-500/15 rounded-2xl px-5 py-5 sm:p-6 space-y-4"
      style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, transparent 60%)" }}
    >
      <p className="text-sm text-slate-300 leading-relaxed">
        Each week, the bottom <span className="font-semibold text-white">{bottomScorersCount}</span>{" "}
        scorer{bottomScorersCount > 1 ? "s" : ""} each owe{" "}
        <span className="font-semibold text-white">${basePenalty.toLocaleString()}</span>
      </p>
      <div>
        <p className="text-xs text-slate-500 mb-1">Added to the pot every week</p>
        <p className="text-3xl font-bold text-emerald-400 tabular-nums">
          ${perWeek.toLocaleString()}
        </p>
      </div>
      <div className="pt-3 border-t border-white/6">
        <p className="text-xs text-slate-500 mb-1">Over {totalWeeks} weeks your pot could grow by</p>
        <p className="text-4xl font-bold text-emerald-400 tabular-nums">
          ${seasonTotal.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
