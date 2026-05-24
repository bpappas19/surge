"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getLeague, getWeekEntries, saveWeekEntry } from "@/lib/storage";
import { calculateWeekTaxes } from "@/lib/calc";
import type { ManualLeague, WeekEntry } from "@/lib/types";
import { ChevronLeft, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

// ─── Shared styles ────────────────────────────────────────────────────────────

const selectCls =
  "w-full bg-navy-900 border border-navy-700 focus:border-emerald-500/50 " +
  "focus:ring-2 focus:ring-emerald-500/10 rounded-lg px-3.5 py-2.5 text-sm " +
  "text-slate-100 outline-none transition-all appearance-none";

const labelCls = "block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2";

// ─── Team checkbox ────────────────────────────────────────────────────────────

function TeamCheckbox({
  name,
  checked,
  onChange,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
        checked
          ? "bg-emerald-500/10 border-emerald-500/30 text-slate-100"
          : "bg-navy-900 border-navy-700 text-slate-400 hover:border-navy-600 hover:text-slate-300"
      }`}
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
          checked ? "bg-emerald-500 border-emerald-500" : "border-navy-600"
        }`}
      >
        {checked && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
      </div>
      <span className="text-sm flex-1">{name}</span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WeekForm() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const editWeek     = searchParams.get("week") ? Number(searchParams.get("week")) : null;

  const [league, setLeague] = useState<ManualLeague | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [weekNumber, setWeekNumber]         = useState<number>(1);
  const [lowestScorer, setLowestScorer]     = useState<string>("");
  const [milestoneSelections, setMilestoneSelections] = useState<string[][]>([]);

  useEffect(() => {
    const l = getLeague(leagueId);
    if (!l) { setLoading(false); return; }

    const entries = getWeekEntries(leagueId);
    const defaultWeek = editWeek ?? (entries[entries.length - 1]?.week ?? 0) + 1;

    setLeague(l);
    setWeekNumber(defaultWeek);
    setMilestoneSelections(l.config.milestones.map(() => []));

    // If editing an existing entry, pre-fill
    if (editWeek) {
      const existing = entries.find((e) => e.week === editWeek);
      if (existing) {
        setLowestScorer(existing.lowestScorerTeamId);
        setMilestoneSelections(
          l.config.milestones.map((_, i) => existing.milestoneResults[i]?.qualifyingTeamIds ?? [])
        );
      }
    }

    setLoading(false);
  }, [leagueId, editWeek]);

  // Toggle a team in a milestone's qualifier list
  const toggleMilestoneTeam = useCallback(
    (milestoneIdx: number, teamId: string) => {
      setMilestoneSelections((prev) => {
        const next = prev.map((sel, i) => {
          if (i !== milestoneIdx) return sel;
          return sel.includes(teamId)
            ? sel.filter((id) => id !== teamId)
            : [...sel, teamId];
        });
        return next;
      });
    },
    []
  );

  // Live preview — recomputes whenever form changes
  const preview = useMemo(() => {
    if (!league || !lowestScorer) return null;
    const entry: WeekEntry = {
      leagueId,
      week: weekNumber,
      lowestScorerTeamId: lowestScorer,
      milestoneResults: milestoneSelections.map((sel) => ({
        qualifyingTeamIds: sel,
      })),
      submittedAt: new Date().toISOString(),
    };
    return calculateWeekTaxes(entry, league);
  }, [league, lowestScorer, weekNumber, milestoneSelections, leagueId]);

  const previewTotal = preview?.reduce((s, c) => s + c.amount, 0) ?? 0;

  function submit() {
    if (!league || !lowestScorer) return;
    const entry: WeekEntry = {
      leagueId,
      week: weekNumber,
      lowestScorerTeamId: lowestScorer,
      milestoneResults: milestoneSelections.map((sel) => ({
        qualifyingTeamIds: sel,
      })),
      submittedAt: new Date().toISOString(),
    };
    saveWeekEntry(entry);
    router.push(`/m/${leagueId}`);
  }

  // ── Loading / not found ────────────────────────────────────────────────────

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

  const hasActiveMilestones = league.config.milestones.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-navy-950 pb-12">
      {/* Inline page header */}
      <div className="w-full max-w-md mx-auto px-4 pt-5 pb-2 flex items-center gap-3">
        <Link
          href={`/m/${leagueId}`}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -ml-1 flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-100">
            {editWeek ? `Edit week ${editWeek}` : `Week ${weekNumber}`}
          </p>
          <p className="text-xs text-slate-600">{league.name}</p>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 pb-6 space-y-6">

        {/* ── Week number ── */}
        {!editWeek && (
          <div>
            <label className={labelCls}>Week number</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekNumber((n) => Math.max(1, n - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-navy-800 border border-navy-700 hover:border-navy-600 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <p className="flex-1 text-center text-2xl font-bold text-slate-100 tabular-nums">
                {weekNumber}
              </p>
              <button
                type="button"
                onClick={() => setWeekNumber((n) => n + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-navy-800 border border-navy-700 hover:border-navy-600 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* ── Lowest scorer ── */}
        <div>
          <label className={labelCls}>Lowest scorer this week</label>
          <div className="relative">
            <select
              value={lowestScorer}
              onChange={(e) => setLowestScorer(e.target.value)}
              className={selectCls}
            >
              <option value="">Select a team</option>
              {league.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none"
              strokeWidth={1.5}
            />
          </div>
          <p className="text-xs text-slate-600 mt-1.5">
            This team owes ${league.config.basePenalty} — always active, no exemptions.
          </p>
        </div>

        {/* ── Milestones ── */}
        {league.config.milestones.map((rule, i) => {
          const label =
            rule.type === "points"
              ? `Points threshold (${rule.threshold}+ pts)`
              : `Touchdown threshold (${rule.threshold}+ TDs)`;
          const exemptNote = rule.exemptIfMultipleQualify
            ? `If 2+ qualify, they're exempt — others pay $${rule.taxPerNonQualifier}.`
            : `All non-qualifiers pay $${rule.taxPerNonQualifier}.`;

          return (
            <div key={i}>
              <label className={labelCls}>{label}</label>
              <p className="text-xs text-slate-600 mb-3">{exemptNote}</p>
              <div className="space-y-2">
                {league.teams.map((team) => (
                  <TeamCheckbox
                    key={team.id}
                    name={team.name}
                    checked={milestoneSelections[i]?.includes(team.id) ?? false}
                    onChange={() => toggleMilestoneTeam(i, team.id)}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Check all teams that <span className="text-slate-400">cleared</span> the threshold.
              </p>
            </div>
          );
        })}

        {/* ── Live preview ── */}
        {preview && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                This week&apos;s breakdown
              </p>
              <p className="text-xs font-semibold text-slate-400 tabular-nums">
                +${previewTotal} to pot
              </p>
            </div>
            <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden divide-y divide-navy-700">
              {preview.map(({ teamId, teamName, amount, reasons }) => (
                <div key={teamId} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{teamName}</p>
                    {reasons.length > 0 ? (
                      <p className="text-xs text-slate-600 mt-0.5 truncate">
                        {reasons.join(" · ")}
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-600 mt-0.5">No charge</p>
                    )}
                  </div>
                  <p
                    className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                      amount > 0 ? "text-red-400" : "text-slate-600"
                    }`}
                  >
                    {amount > 0 ? `-$${amount}` : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Submit ── */}
        {!lowestScorer && (
          <div className="flex items-start gap-2.5 bg-navy-800 border border-navy-700 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-xs text-slate-600">Select the lowest scorer to submit.</p>
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!lowestScorer}
          className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          {editWeek ? `Update week ${editWeek}` : `Submit week ${weekNumber}`}
        </button>

      </div>
    </main>
  );
}
