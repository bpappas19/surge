const BASE = "https://api.sleeper.app/v1";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  season_type: string;
  status: "pre_draft" | "drafting" | "in_season" | "complete" | string;
  sport: string;
  total_rosters: number;
  settings: {
    playoff_week_start: number;
    last_scored_leg: number;
    num_teams: number;
  };
  avatar: string | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  league_id: string;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
  };
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
  starters: string[];
  players: string[] | null;
  custom_points: number | null;
}

export interface SleeperLeagueUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata: {
    team_name?: string;
    team_name_update?: string;
  };
}

export interface SleeperBracketMatch {
  r: number; // round
  m: number; // match number within round
  t1: number | null; // roster_id team 1
  t2: number | null; // roster_id team 2
  w: number | null; // roster_id of winner
  l: number | null; // roster_id of loser
  t1_from?: { w?: number; l?: number } | null;
  t2_from?: { w?: number; l?: number } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`Sleeper API error ${res.status} — ${path}`);
  }
  return res.json() as Promise<T>;
}

// ─── API calls ─────────────────────────────────────────────────────────────

export async function getUser(username: string): Promise<SleeperUser> {
  const data = await apiFetch<SleeperUser | null>(`/user/${username}`);
  if (!data || !data.user_id) {
    throw new Error(`Username "${username}" not found on Sleeper`);
  }
  return data;
}

export async function getUserLeagues(
  userId: string,
  season = "2025"
): Promise<SleeperLeague[]> {
  const data = await apiFetch<SleeperLeague[] | null>(
    `/user/${userId}/leagues/nfl/${season}`
  );
  return data ?? [];
}

export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  return apiFetch<SleeperLeague>(`/league/${leagueId}`);
}

export async function getLeagueRosters(
  leagueId: string
): Promise<SleeperRoster[]> {
  return apiFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`);
}

export async function getLeagueUsers(
  leagueId: string
): Promise<SleeperLeagueUser[]> {
  return apiFetch<SleeperLeagueUser[]>(`/league/${leagueId}/users`);
}

export async function getMatchups(
  leagueId: string,
  week: number
): Promise<SleeperMatchup[]> {
  const data = await apiFetch<SleeperMatchup[] | null>(
    `/league/${leagueId}/matchups/${week}`
  );
  return data ?? [];
}

export async function getWinnersBracket(
  leagueId: string
): Promise<SleeperBracketMatch[]> {
  const data = await apiFetch<SleeperBracketMatch[] | null>(
    `/league/${leagueId}/winners_bracket`
  );
  return data ?? [];
}

// ─── Player stats ──────────────────────────────────────────────────────────

export interface SleeperPlayerStats {
  rush_td?: number;
  rec_td?: number;
  pass_td?: number;
  fum_ret_td?: number;
  def_td?: number;
  [key: string]: number | undefined;
}

/** Returns all NFL player stats for one regular-season week, keyed by player_id. */
export async function getWeekPlayerStats(
  season: string,
  week: number
): Promise<Record<string, SleeperPlayerStats>> {
  const data = await apiFetch<Record<string, SleeperPlayerStats> | null>(
    `/stats/nfl/regular/${season}/${week}`
  );
  return data ?? {};
}

/** Sums all touchdown-type stats for a single player's week. */
export function countPlayerTDs(stats: SleeperPlayerStats | undefined): number {
  if (!stats) return 0;
  return (
    (stats.rush_td ?? 0) +
    (stats.rec_td ?? 0) +
    (stats.pass_td ?? 0) +
    (stats.fum_ret_td ?? 0) +
    (stats.def_td ?? 0)
  );
}

// ─── Derived helpers ───────────────────────────────────────────────────────

/** Returns the roster_id of the champion from the winners bracket, or null. */
export function findChampionRosterId(
  bracket: SleeperBracketMatch[]
): number | null {
  if (!bracket.length) return null;
  const maxRound = Math.max(...bracket.map((m) => m.r));
  // Championship game is always match 1 in the final round
  const final =
    bracket.find((m) => m.r === maxRound && m.m === 1) ??
    bracket.find((m) => m.r === maxRound);
  return final?.w ?? null;
}

/** Returns the avatar URL for a Sleeper avatar hash (or undefined). */
export function avatarUrl(hash: string | null | undefined): string | undefined {
  return hash ? `https://sleepercdn.com/avatars/thumbs/${hash}` : undefined;
}
