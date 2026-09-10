/**
 * Single source of truth, exposed to React through `useSyncExternalStore`.
 *
 * Why an external store rather than context: the roadmap, history, settings and
 * editor all read the same state, and an external store keeps `useNorthstar()`
 * callable anywhere without threading providers or props through the tree.
 *
 * Invariants:
 *  - `state.days` advances ONLY through `checkIn`, at most once per local
 *    calendar day. Nothing here reacts to elapsed time.
 *  - Transitions in `state.ts` return their input unchanged for a no-op, so the
 *    identity check in `apply` suppresses pointless renders and writes.
 *  - `snapshot` is replaced only when something actually changed, so its
 *    reference is stable between renders and cannot loop the store.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readState, writeState } from "./db";
import {
  activeMilestones,
  addMilestone as addMilestoneTo,
  advanceDay,
  checkIn as checkInTo,
  checkedInToday,
  claimReward,
  DEFAULT_GAP,
  hydrate,
  moveMilestone as moveMilestoneIn,
  nextMilestone,
  progress as progressOf,
  removeMilestone as removeMilestoneFrom,
  resetStreak,
  totalDays,
  unlockedCount,
  updateMilestone as updateMilestoneIn,
  type ActiveMilestone,
  type MilestonePatch,
  type Progress,
  type State,
} from "./state";

/**
 * Development builds allow repeat check-ins so the check-in and unlock
 * sequences can be exercised without waiting for the next calendar day.
 * This flag is false in a production `vite build`, so the daily guard is
 * always enforced in the shipped app.
 */
const ALLOW_REPEAT_CHECK_IN = import.meta.env.DEV;

/**
 * The last thing that happened, for components that need to run a sequence
 * rather than just render a new value. Consumed by the roadmap to drive the
 * check-in and unlock animations.
 */
export type StoreEvent =
  | { type: "check-in"; at: number }
  | { type: "unlock"; milestoneId: string; at: number }
  | { type: "claim"; milestoneId: string; at: number };

/** How long an event stays readable before it clears itself. */
const EVENT_TTL_MS = 1600;

type Snapshot = {
  state: State;
  event: StoreEvent | null;
  /** Bumped when the local day rolls over, to re-evaluate `checkedIn`. */
  tick: number;
};

let snapshot: Snapshot = {
  state: hydrate(undefined),
  event: null,
  tick: 0,
};

const listeners = new Set<() => void>();
let eventTimer: number | undefined;
let rolloverTimer: number | undefined;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function persist(state: State): void {
  void writeState(state).catch((error: unknown) => {
    console.error("northstar: failed to persist state", error);
  });
}

function setEvent(event: StoreEvent | null): void {
  snapshot = { ...snapshot, event };
  if (eventTimer !== undefined) window.clearTimeout(eventTimer);
  if (event === null) return;

  eventTimer = window.setTimeout(() => {
    snapshot = { ...snapshot, event: null };
    emit();
  }, EVENT_TTL_MS);
}

/**
 * Apply a transition, then publish. `event` describes what the change means so
 * the UI can animate it; pass a factory because the event may depend on both
 * the previous and next state.
 */
function apply(
  transition: (current: State) => State,
  describe?: (previous: State, next: State) => StoreEvent | null,
): void {
  const previous = snapshot.state;
  const next = transition(previous);
  if (next === previous) return;

  snapshot = { ...snapshot, state: next };
  setEvent(describe?.(previous, next) ?? null);
  emit();
  persist(next);
}

/** The check-in button re-arms at midnight, so re-publish when the day rolls. */
function scheduleRollover(): void {
  if (rolloverTimer !== undefined) window.clearTimeout(rolloverTimer);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
  rolloverTimer = window.setTimeout(() => {
    snapshot = { ...snapshot, tick: snapshot.tick + 1 };
    emit();
    scheduleRollover();
  }, next.getTime() - now.getTime());
}

/** Load persisted state and start the clock. Call once, before rendering. */
export async function initStore(): Promise<void> {
  const raw = await readState();
  snapshot = { state: hydrate(raw), event: null, tick: 0 };

  // Nothing persisted yet: commit the seeded roadmap so milestone ids are
  // stable across reloads instead of being regenerated every launch.
  if (raw === undefined) persist(snapshot.state);

  scheduleRollover();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    // Returning to the app can cross a day boundary.
    snapshot = { ...snapshot, tick: snapshot.tick + 1 };
    emit();
    scheduleRollover();
  });
}

export type Store = {
  state: State;
  /** Completed days in the current run. */
  days: number;
  progress: Progress;
  /** Active roadmap, nearest-first. */
  milestones: ActiveMilestone[];
  /** Nearest milestone still ahead, or null when the roadmap is exhausted. */
  next: ActiveMilestone | null;
  /** True once today's check-in is done; the control disarms until midnight. */
  checkedIn: boolean;
  /** Whether the control should accept a press. Always true in development. */
  canCheckIn: boolean;
  /** Rewards unlocked in this run, claimed or not. */
  unlocked: number;
  /** What just happened, for animation sequencing. Clears itself. */
  event: StoreEvent | null;
  /** The northstar's distance in days: every gap added up. */
  totalDays: number;

  checkIn: () => void;
  claim: (milestoneId: string) => void;
  reset: () => void;
  addMilestone: (reward: string, note?: string, gap?: number) => void;
  updateMilestone: (id: string, patch: MilestonePatch) => void;
  removeMilestone: (id: string) => void;
  moveMilestone: (id: string, direction: -1 | 1) => void;
};

export function useNorthstar(): Store {
  const { state, event, tick } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const checkIn = useCallback(() => {
    const now = new Date();
    apply(
      (current) => (ALLOW_REPEAT_CHECK_IN ? advanceDay(current, now) : checkInTo(current, now)),
      (previous, next) => {
        const gained = unlockedCount(next) - unlockedCount(previous);
        if (gained <= 0) return { type: "check-in", at: Date.now() };

        // The milestone this check-in just reached is the last one now unlocked.
        const reached = activeMilestones(next)[unlockedCount(next) - 1];
        if (reached === undefined) return { type: "check-in", at: Date.now() };
        return { type: "unlock", milestoneId: reached.milestone.id, at: Date.now() };
      },
    );
  }, []);

  const claim = useCallback((milestoneId: string) => {
    const now = new Date();
    apply(
      (current) => claimReward(current, milestoneId, now),
      () => ({ type: "claim", milestoneId, at: Date.now() }),
    );
  }, []);

  const reset = useCallback(() => {
    const now = new Date();
    apply((current) => resetStreak(current, now));
  }, []);

  const addMilestone = useCallback((reward: string, note = "", gap = DEFAULT_GAP) => {
    apply((current) => addMilestoneTo(current, reward, note, gap));
  }, []);

  const updateMilestone = useCallback((id: string, patch: MilestonePatch) => {
    apply((current) => updateMilestoneIn(current, id, patch));
  }, []);

  const removeMilestone = useCallback((id: string) => {
    apply((current) => removeMilestoneFrom(current, id));
  }, []);

  const moveMilestone = useCallback((id: string, direction: -1 | 1) => {
    apply((current) => moveMilestoneIn(current, id, direction));
  }, []);

  return useMemo<Store>(() => {
    // `tick` participates so the day-rollover republish re-evaluates `checkedIn`.
    void tick;
    const checkedIn = checkedInToday(state, new Date());
    return {
      state,
      days: state.days,
      progress: progressOf(state),
      milestones: activeMilestones(state),
      next: nextMilestone(state),
      checkedIn,
      canCheckIn: !checkedIn || ALLOW_REPEAT_CHECK_IN,
      unlocked: unlockedCount(state),
      event,
      totalDays: totalDays(state),
      checkIn,
      claim,
      reset,
      addMilestone,
      updateMilestone,
      removeMilestone,
      moveMilestone,
    };
  }, [
    state,
    event,
    tick,
    checkIn,
    claim,
    reset,
    addMilestone,
    updateMilestone,
    removeMilestone,
    moveMilestone,
  ]);
}
