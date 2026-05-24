/**
 * localStorage helpers for Manual Mode leagues.
 * All functions are safe to import in any client component —
 * they silently no-op when called server-side.
 */

import type { ManualLeague, WeekEntry } from "./types";

const LEAGUES_KEY = "surge_leagues";
const weekKey = (leagueId: string) => `surge_weeks_${leagueId}`;

// ─── Leagues ────────────────────────────────────────────────────────────────

export function getAllLeagues(): ManualLeague[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LEAGUES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getLeague(id: string): ManualLeague | null {
  return getAllLeagues().find((l) => l.id === id) ?? null;
}

export function saveLeague(league: ManualLeague): void {
  if (typeof window === "undefined") return;
  const all = getAllLeagues();
  const idx = all.findIndex((l) => l.id === league.id);
  if (idx >= 0) all[idx] = league;
  else all.push(league);
  localStorage.setItem(LEAGUES_KEY, JSON.stringify(all));
}

export function deleteLeague(id: string): void {
  if (typeof window === "undefined") return;
  const all = getAllLeagues().filter((l) => l.id !== id);
  localStorage.setItem(LEAGUES_KEY, JSON.stringify(all));
  localStorage.removeItem(weekKey(id));
}

// ─── Week entries ────────────────────────────────────────────────────────────

export function getWeekEntries(leagueId: string): WeekEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(weekKey(leagueId)) ?? "[]");
  } catch {
    return [];
  }
}

export function saveWeekEntry(entry: WeekEntry): void {
  if (typeof window === "undefined") return;
  const all = getWeekEntries(entry.leagueId);
  const idx = all.findIndex((e) => e.week === entry.week);
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  // Keep sorted by week ascending
  all.sort((a, b) => a.week - b.week);
  localStorage.setItem(weekKey(entry.leagueId), JSON.stringify(all));
}

export function deleteWeekEntry(leagueId: string, week: number): void {
  if (typeof window === "undefined") return;
  const all = getWeekEntries(leagueId).filter((e) => e.week !== week);
  localStorage.setItem(weekKey(leagueId), JSON.stringify(all));
}

// ─── Sleeper league settings ─────────────────────────────────────────────────

export interface SleeperSettings {
  leagueId: string;
  buyIn: number;
  teamCount: number;
}

const SLEEPER_SETTINGS_KEY = "surge_sleeper_settings";

function allSleeperSettings(): SleeperSettings[] {
  try {
    return JSON.parse(localStorage.getItem(SLEEPER_SETTINGS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getSleeperSettings(leagueId: string): SleeperSettings | null {
  if (typeof window === "undefined") return null;
  return allSleeperSettings().find((s) => s.leagueId === leagueId) ?? null;
}

export function saveSleeperSettings(settings: SleeperSettings): void {
  if (typeof window === "undefined") return;
  const all = allSleeperSettings();
  const idx = all.findIndex((s) => s.leagueId === settings.leagueId);
  if (idx >= 0) all[idx] = settings;
  else all.push(settings);
  localStorage.setItem(SLEEPER_SETTINGS_KEY, JSON.stringify(all));
}
