/**
 * Northstar state model.
 *
 * Invariants that the whole app leans on:
 *  - `days` is a stored counter. It advances only through the deliberate
 *    `checkIn` action, once per local calendar day. It never advances because
 *    time passed while the app was closed: there is no elapsed-time anchor.
 *  - `milestones` is ordered nearest-first. The active roadmap is the subset
 *    with `archived === false`; an active milestone's requirement is derived
 *    purely from its position in that subset, which is what makes a reset
 *    renumber the remaining milestones (old 14-day node becomes the 7-day one).
 *  - A milestone moves through three states: locked -> available -> claimed.
 *    Unlocking (`available`) is purely a function of `days` versus the
 *    milestone's requirement. Claiming is a separate, deliberate act that
 *    stamps `claimedAt`; only claimed milestones are archived on reset.
 *  - Archived milestones are never deleted by a reset. They are retained for
 *    the history view.
 */

export const DEFAULT_GAP = 7;
export const STATE_VERSION = 8;

export type Milestone = {
  id: string;
  /** The reward itself, e.g. "New shoes". Shown as the node headline. */
  reward: string;
  /** Optional detail line, e.g. a budget or a condition. */
  note: string;
  /** Days after the previous reward. At least 1; absolute days are the running sum. */
  gap: number;
  /** Data URL for the reward's picture; null when none has been chosen. */
  image: string | null;
  /** ISO timestamp the reward was claimed; null while unclaimed. */
  claimedAt: string | null;
  /** Archived milestones stay in the database but leave the active roadmap. */
  archived: boolean;
  archivedAt: string | null;
  /** The run that unlocked this milestone before it was archived. */
  archivedRun: number | null;
  /** Days the run had reached when this was archived; null if never recorded. */
  archivedDays: number | null;
};

/** Fields an edit may change. `image: null` clears an existing picture. */
export type MilestonePatch = { reward?: string; note?: string; gap?: number; image?: string | null };

export type State = {
  version: typeof STATE_VERSION;
  /** Ordered nearest-first. Includes archived entries. */
  milestones: Milestone[];
  /** Completed days in the current run. Advances only through `checkIn`. */
  days: number;
  /** ISO timestamp of the most recent check-in; null when the run is empty. */
  lastCheckIn: string | null;
  /** Bumped by every reset. Stamped onto milestones archived by that reset. */
  run: number;
};

export type MilestoneStatus = "locked" | "available" | "claimed";

export type ActiveMilestone = {
  milestone: Milestone;
  /** Position in the active roadmap, 0 = nearest. */
  index: number;
  /** Completed days required to unlock, i.e. (index + 1) * 7. */
  requirement: number;
  status: MilestoneStatus;
};

export type Progress = {
  /** Days completed toward the next reward, 0..required. */
  banked: number;
  /** Gap of the stretch being walked. */
  required: number;
  /** Days still needed, 0 when the roadmap is exhausted. */
  remaining: number;
  /** banked / required, 0..1. */
  fraction: number;
};

/* ------------------------------------------------------------------ helpers */

export function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeMilestone(reward: string, note = "", gap = DEFAULT_GAP): Milestone {
  return {
    id: newId(),
    reward,
    note,
    gap: Math.max(1, Math.floor(gap)),
    image: null,
    claimedAt: null,
    archived: false,
    archivedAt: null,
    archivedRun: null,
    archivedDays: null,
  };
}

/** Local-calendar day key. Deliberately local, not UTC: progress is tracked locally. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * A roadmap to develop against. Gaps sum to 365, dense early where the habit
 * is youngest then stretching out: day 3, 7, 14, 21, 30, 60, 90, 120, 150,
 * 180, 240, 300, 365.
 *
 * Referenced only from the development branch below, so a production build
 * drops both this function and its strings: naming rewards is personal, and a
 * real roadmap starts empty rather than presuming someone else's.
 */
function developmentRoadmap(): Milestone[] {
  return [
    makeMilestone("Small treat", "A little something.", 3),
    makeMilestone("Movie night", "", 4),
    makeMilestone("New shoes", "", 7),
    makeMilestone("Dinner out", "", 7),
    makeMilestone("Concert tickets", "", 9),
    makeMilestone("Monitor upgrade", "", 30),
    makeMilestone("Mechanical keyboard", "", 30),
    makeMilestone("Noise-cancelling headphones", "", 30),
    makeMilestone("Weekend away", "Somewhere quiet.", 30),
    makeMilestone("New phone", "", 30),
    makeMilestone("Camera", "", 60),
    makeMilestone("Bicycle", "", 60),
    makeMilestone("A big trip", "", 65),
  ];
}

export function createInitialState(): State {
  return {
    version: STATE_VERSION,
    // `import.meta.env.DEV` is replaced at build time, so the seed and every
    // reward name it holds are eliminated from a production bundle rather than
    // merely skipped at runtime.
    milestones: import.meta.env.DEV ? developmentRoadmap() : [],
    days: 0,
    lastCheckIn: null,
    run: 1,
  };
}

/* -------------------------------------------------------------- derivations */

export function activeMilestones(state: State): ActiveMilestone[] {
  const active = state.milestones.filter((m) => !m.archived);
  let requirement = 0;
  return active.map((milestone, index) => {
    requirement += milestone.gap;
    const status: MilestoneStatus =
      milestone.claimedAt !== null ? "claimed" : state.days >= requirement ? "available" : "locked";
    return { milestone, index, requirement, status };
  });
}

/** The northstar's distance: every gap on the active roadmap, added up. */
export function totalDays(state: State): number {
  return state.milestones.reduce((sum, m) => (m.archived ? sum : sum + m.gap), 0);
}

/** How many active milestones the current day count has unlocked. */
export function unlockedCount(state: State): number {
  return activeMilestones(state).filter((entry) => state.days >= entry.requirement).length;
}

/** The nearest milestone whose requirement is still ahead, or null when the roadmap is exhausted. */
export function nextMilestone(state: State): ActiveMilestone | null {
  return activeMilestones(state).find((entry) => entry.requirement > state.days) ?? null;
}

/** Progress toward the next reward. */
export function progress(state: State): Progress {
  const next = nextMilestone(state);
  if (next === null) {
    // Nothing left to walk. Report a finished stretch so `fraction` stays 1.
    const entries = activeMilestones(state);
    const last = entries[entries.length - 1];
    const span = last === undefined ? 0 : last.milestone.gap;
    return { banked: span, required: span, remaining: 0, fraction: 1 };
  }

  const required = next.milestone.gap;
  const floor = next.requirement - required;
  const banked = Math.max(0, Math.min(required, state.days - floor));
  const remaining = next.requirement - state.days;
  const fraction = required <= 0 ? 1 : Math.max(0, Math.min(1, banked / required));
  return { banked, required, remaining, fraction };
}

export type HistoryGroup = {
  /** Run these rewards were claimed in. */
  run: number;
  /** True for the run currently in progress. */
  current: boolean;
  rewards: string[];
  /** Days this run reached, or null when it closed before this was recorded. */
  days: number | null;
};

/** Rewards actually claimed so far, newest run first. */
export function earnedHistory(state: State): HistoryGroup[] {
  const groups: HistoryGroup[] = [];

  const current = state.milestones
    .filter((m) => !m.archived && m.claimedAt !== null)
    .map((m) => m.reward);
  if (current.length > 0) {
    groups.push({ run: state.run, current: true, rewards: current, days: state.days });
  }

  const runs = new Map<number, { rewards: string[]; days: number | null }>();
  for (const m of state.milestones) {
    if (!m.archived) continue;
    const run = m.archivedRun ?? 0;
    const days = typeof m.archivedDays === "number" ? m.archivedDays : null;
    const bucket = runs.get(run);
    if (bucket === undefined) {
      runs.set(run, { rewards: [m.reward], days });
      continue;
    }
    bucket.rewards.push(m.reward);
    // One reset stamps every milestone it archives with the same count, so a
    // recorded value anywhere in the run is the run's count. Taking the higher
    // of the two keeps an older unrecorded entry from masking it.
    if (days !== null) bucket.days = bucket.days === null ? days : Math.max(bucket.days, days);
  }

  for (const run of [...runs.keys()].sort((a, b) => b - a)) {
    const bucket = runs.get(run);
    if (bucket === undefined) continue;
    groups.push({ run, current: false, rewards: bucket.rewards, days: bucket.days });
  }

  return groups;
}

/* ------------------------------------------------------------- transitions */
/* Every transition returns a new State and never mutates its input. */

/** True when today's check-in has already been recorded. */
export function checkedInToday(state: State, now: Date): boolean {
  return typeof state.lastCheckIn === "string" && dayKey(new Date(state.lastCheckIn)) === dayKey(now);
}

/**
 * Advance one day unconditionally. The primitive behind `checkIn`; the daily
 * guard lives in `checkIn`, not here.
 */
export function advanceDay(state: State, now: Date): State {
  return { ...state, days: state.days + 1, lastCheckIn: now.toISOString() };
}

/**
 * Bank today's check-in. Returns the input unchanged when today is already
 * done, so a double tap or a replayed event cannot inflate the count.
 */
export function checkIn(state: State, now: Date): State {
  if (checkedInToday(state, now)) return state;
  return advanceDay(state, now);
}

/**
 * Claim an unlocked reward. A no-op when the milestone is missing, already
 * claimed, or not yet unlocked.
 */
export function claimReward(state: State, id: string, now: Date): State {
  const entry = activeMilestones(state).find((e) => e.milestone.id === id);
  if (entry === undefined) return state;
  if (entry.milestone.claimedAt !== null) return state;
  if (entry.requirement > state.days) return state;

  const stamp = now.toISOString();
  return {
    ...state,
    milestones: state.milestones.map((m) => (m.id === id ? { ...m, claimedAt: stamp } : m)),
  };
}

/**
 * Explicit reset. Archives every *claimed* milestone (hidden, retained),
 * clears the day count, and starts a new run. Milestones that were never
 * claimed stay and renumber, so the next one becomes the 7-day target.
 */
export function resetStreak(state: State, now: Date): State {
  const hasClaimed = state.milestones.some((m) => !m.archived && m.claimedAt !== null);
  if (!hasClaimed && state.days === 0 && state.lastCheckIn === null) return state;

  const stamp = now.toISOString();
  const milestones = state.milestones.map((m) => {
    if (m.archived || m.claimedAt === null) return m;
    return { ...m, archived: true, archivedAt: stamp, archivedRun: state.run, archivedDays: state.days };
  });

  return { ...state, milestones, days: 0, lastCheckIn: null, run: state.run + 1 };
}

/* ---------------------------------------------------------- milestone edits */

export function addMilestone(state: State, reward: string, note = "", gap = DEFAULT_GAP): State {
  return { ...state, milestones: [...state.milestones, makeMilestone(reward, note, gap)] };
}

export function updateMilestone(state: State, id: string, patch: MilestonePatch): State {
  return {
    ...state,
    milestones: state.milestones.map((m) =>
      m.id === id
        ? {
            ...m,
            reward: patch.reward ?? m.reward,
            note: patch.note ?? m.note,
            gap: patch.gap === undefined ? m.gap : Math.max(1, Math.floor(patch.gap)),
            // `null` clears the picture, so only `undefined` means "leave alone".
            image: patch.image !== undefined ? patch.image : m.image,
          }
        : m,
    ),
  };
}

export function removeMilestone(state: State, id: string): State {
  return { ...state, milestones: state.milestones.filter((m) => m.id !== id) };
}

/**
 * Move an active milestone one slot toward (`-1`) or away from (`+1`) the
 * viewer. Swaps against the neighbouring *active* milestone so interleaved
 * archived entries never absorb the move.
 */
export function moveMilestone(state: State, id: string, direction: -1 | 1): State {
  const positions: number[] = [];
  state.milestones.forEach((m, i) => {
    if (!m.archived) positions.push(i);
  });

  const at = positions.findIndex((i) => state.milestones[i]?.id === id);
  if (at === -1) return state;

  const target = at + direction;
  if (target < 0 || target >= positions.length) return state;

  const a = positions[at]!;
  const b = positions[target]!;
  const milestones = [...state.milestones];
  const tmp = milestones[a]!;
  milestones[a] = milestones[b]!;
  milestones[b] = tmp;
  return { ...state, milestones };
}

/* ---------------------------------------------------------------- hydration */

/**
 * Shapes this module has persisted historically. Version 1 stored the day
 * count directly, version 2 stored an elapsed-time anchor instead. Version 3
 * had no reward pictures; hydration defaults `image` to null for those records.
 * Versions up to 4 did not record a run's day count, so milestones archived by
 * them hydrate with `archivedDays: null` and their counts are unknowable.
 * Versions up to 5 had no northstar, so they hydrate with an empty one.
 * Versions up to 6 had a fixed seven-day cadence with no stored gap, so their
 * milestones hydrate at a gap of `DEFAULT_GAP` (7), which keeps every
 * existing requirement exactly what it was. Version 7 stored a separate
 * northstar name for the road's goal; the furthest reward now names itself,
 * so that field is simply ignored on load.
 */
type PersistedShape = Partial<State> & {
  days?: unknown;
  /** Version 2 only: the run's start anchor the day count was derived from. */
  startedAt?: unknown;
};

/** Coerce unknown persisted data into a valid State, discarding junk. */
export function hydrate(raw: unknown, now: Date): State {
  if (typeof raw !== "object" || raw === null) return createInitialState();
  const input = raw as PersistedShape;

  const milestones = Array.isArray(input.milestones)
    ? input.milestones.flatMap((entry): Milestone[] => {
        if (typeof entry !== "object" || entry === null) return [];
        const m = entry as Partial<Milestone>;
        if (typeof m.reward !== "string") return [];
        return [
          {
            id: typeof m.id === "string" ? m.id : newId(),
            reward: m.reward,
            note: typeof m.note === "string" ? m.note : "",
            gap: typeof m.gap === "number" && Number.isFinite(m.gap) ? Math.max(1, Math.floor(m.gap)) : DEFAULT_GAP,
            image: typeof m.image === "string" ? m.image : null,
            claimedAt: typeof m.claimedAt === "string" ? m.claimedAt : null,
            archived: m.archived === true,
            archivedAt: typeof m.archivedAt === "string" ? m.archivedAt : null,
            archivedRun: typeof m.archivedRun === "number" ? m.archivedRun : null,
            archivedDays: typeof m.archivedDays === "number" ? m.archivedDays : null,
          },
        ];
      })
    : [];

  let days: number;
  if (typeof input.days === "number" && Number.isFinite(input.days)) {
    days = Math.max(0, Math.floor(input.days));
  } else if (typeof input.startedAt === "string") {
    // v2 migration: preserve the existing count by measuring whole local
    // calendar days from the old anchor to now.
    const anchor = new Date(input.startedAt);
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const anchorMidnight = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()).getTime();
    days = Math.max(0, Math.round((nowMidnight - anchorMidnight) / 86_400_000));
  } else {
    days = 0;
  }

  return {
    version: STATE_VERSION,
    milestones,
    days,
    lastCheckIn: typeof input.lastCheckIn === "string" ? input.lastCheckIn : null,
    run: typeof input.run === "number" && input.run >= 1 ? Math.floor(input.run) : 1,
  };
}
