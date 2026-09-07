/**
 * Shared motion vocabulary.
 *
 * One place for easing and duration so every interaction feels like the same
 * product. Values lean on the iOS convention of fast, decelerating motion:
 * things arrive quickly and settle softly rather than easing in and out.
 */

/** Decelerating cubic. Default for anything entering or advancing. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Symmetric cubic. Use only for things that leave and come back. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** Seconds. */
export const DUR = {
  /** Touch feedback. Must feel instant. */
  press: 0.12,
  fast: 0.18,
  base: 0.3,
  slow: 0.55,
} as const;

/** Crisp settle for controls and small state changes. */
export const SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.9,
} as const;

/** Softer settle for travel over distance: progress fill, marker, layout. */
export const SPRING_SOFT = {
  type: "spring",
  stiffness: 240,
  damping: 28,
  mass: 1,
} as const;

/**
 * Milestone unlock delays, in seconds. The node's colour and border change on
 * their own when status flips; these two delays only keep the label from
 * arriving in the same frame, so the moment reads as ordered rather than
 * announced. Everything is over inside 350ms.
 */
export const UNLOCK = {
  /** Reward name settles just after the node has changed. */
  reward: 0.1,
  /** Claim affordance arrives last. */
  claim: 0.18,
} as const;
