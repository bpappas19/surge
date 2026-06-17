"use client";

/**
 * "Which team is yours?" picker for manual leagues.
 * Lists every team from manual_teams — unclaimed teams are selectable,
 * already-claimed teams are shown grayed out.
 */

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import type { ManualTeamRow } from "@/lib/db";

interface Props {
  teams: ManualTeamRow[];
  onClaim: (teamId: string) => Promise<void>;
}

export function ClaimTeamList({ teams, onClaim }: Props) {
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleClaim(teamId: string) {
    setClaimingId(teamId);
    setError("");
    try {
      await onClaim(teamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim team.");
      setClaimingId(null);
    }
  }

  return (
    <div className="w-full">
      <p className="text-sm font-semibold text-white mb-1">Which team is yours?</p>
      <p className="text-xs text-slate-500 mb-4">Pick your team to claim your spot in the league.</p>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-[#0d1420] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/6">
        {teams.map((team) => {
          const claimed     = !!team.claimed_by_user_id;
          const isClaiming  = claimingId === team.id;

          if (claimed) {
            return (
              <div key={team.id} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-slate-600">{team.team_name}</span>
                <span className="text-xs text-slate-700">Already claimed</span>
              </div>
            );
          }

          return (
            <button
              key={team.id}
              onClick={() => handleClaim(team.id)}
              disabled={claimingId !== null}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/3 transition-colors text-left disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <span className="text-sm font-semibold text-white">{team.team_name}</span>
              {isClaiming ? (
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin flex-shrink-0" />
              ) : (
                <span className="text-xs text-emerald-400 flex-shrink-0">Unclaimed</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
