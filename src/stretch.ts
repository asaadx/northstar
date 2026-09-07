/**
 * TEMPORARY. Compares how a stretch's drawn height should follow its gap.
 *
 * Every stretch currently draws at the same height whatever its gap, so
 * pixels-per-day swings 22x across a year: 53 on a 3-day gap, 2.5 on a
 * 65-day one. These are the candidates. The mode is read from the URL and
 * the picker is development-only, so none of this can reach a production
 * build. Once a formula is chosen it gets hardcoded and this file is deleted.
 */

export type StretchMode = "uniform" | "linear" | "root" | "clamp";

export const STRETCH_MODES: readonly StretchMode[] = ["uniform", "linear", "root", "clamp"];

/** Today's flat height, and the value `uniform` keeps. */
const BASE_REM = 10;

/** Shortest a stretch may draw and still keep the day marker clear of both nodes. */
const MIN_REM = 6;

/** Linear slope. At 2rem a 3-day gap lands exactly on the floor. */
const PER_DAY_REM = 2;

/** Root coefficient, chosen so a 3-day gap also lands on the floor. */
const ROOT_REM = 3.46;

/** Ceiling for `clamp`, past which every long gap looks alike. */
const MAX_REM = 24;

const QUERY_KEY = "stretch";

function isMode(value: string | null): value is StretchMode {
  return value !== null && (STRETCH_MODES as readonly string[]).includes(value);
}

/** Read once per load. Selecting a mode reloads, so this never goes stale. */
export function stretchMode(): StretchMode {
  if (!import.meta.env.DEV) return "uniform";
  const value = new URLSearchParams(window.location.search).get(QUERY_KEY);
  return isMode(value) ? value : "uniform";
}

export function selectStretchMode(mode: StretchMode): void {
  const url = new URL(window.location.href);
  url.searchParams.set(QUERY_KEY, mode);
  window.location.assign(url.toString());
}

/**
 * A stretch's height in rem. `gap` is null for the final stretch up to the
 * northstar, which spans no days and always draws at the base height.
 */
export function stretchHeight(gap: number | null, mode: StretchMode): string {
  if (gap === null || mode === "uniform") return `${BASE_REM}rem`;
  const days = Math.max(1, gap);
  if (mode === "linear") return `${Math.max(MIN_REM, days * PER_DAY_REM)}rem`;
  if (mode === "root") return `${Math.max(MIN_REM, ROOT_REM * Math.sqrt(days))}rem`;
  return `${Math.min(MAX_REM, Math.max(MIN_REM, days * PER_DAY_REM))}rem`;
}
