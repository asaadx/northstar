/**
 * A single roadmap circle: locked, available to claim, or claimed. The
 * glyph inside transitions rather than swaps. The status change itself
 * carries the moment via CSS; motion here only smooths the edges.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MilestoneStatus } from "../state";
import { DUR, SPRING } from "../motion";

type MilestoneNodeProps = {
  status: MilestoneStatus;
  /** This node just crossed into "available" as part of the current event. */
  justUnlocked: boolean;
  /** This node just moved from "available" to "claimed". */
  justClaimed: boolean;
  /** Data URL for the reward's picture, or null when none was chosen. */
  image: string | null;
};

export default function MilestoneNode({ status, justUnlocked, justClaimed, image }: MilestoneNodeProps) {
  const reducedMotion = useReducedMotion();

  const pulse =
    justUnlocked && !reducedMotion
      ? { scale: [1, 1.05, 1] as number[] }
      : justClaimed && !reducedMotion
        ? { scale: [1, 1.03, 1] as number[] }
        : { scale: 1 };

  const transition =
    justUnlocked && !reducedMotion
      ? { duration: DUR.base, times: [0, 0.4, 1], ease: "easeOut" as const }
      : { ...SPRING };

  // A picture speaks for itself once the milestone is reached, so only a locked
  // one is marked. Without a picture the glyphs still carry the whole message.
  const glyph: GlyphKind | null =
    status === "locked" ? "closed" : image !== null ? null : status === "available" ? "open" : "check";

  return (
    <motion.div className={`node node--${status}`} animate={pulse} transition={transition}>
      {image !== null && <img className="node__image" src={image} alt="" />}
      <AnimatePresence initial={false}>
        {glyph !== null && <Glyph key={glyph} kind={glyph} reducedMotion={!!reducedMotion} />}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Absolutely positioned (see `.node__glyph`) so the outgoing and incoming
 * copies overlap in place instead of the node's grid gaining a second
 * implicit row, which would push the entering glyph below center.
 */
type GlyphKind = "closed" | "open" | "check";

function Glyph({ kind, reducedMotion }: { kind: GlyphKind; reducedMotion: boolean }) {
  const variants = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.6, rotate: -12 },
      };

  return (
    <motion.span
      className="node__glyph"
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={{ ...SPRING }}
    >
      {kind === "closed" && <LockGlyph open={false} />}
      {kind === "open" && <LockGlyph open={true} />}
      {kind === "check" && <CheckGlyph />}
    </motion.span>
  );
}

function LockGlyph({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1.5rem"
      height="1.5rem"
    >
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      {open ? (
        <path d="M8.25 10.5V7.25a3.75 3.75 0 0 1 6.4-2.65" />
      ) : (
        <path d="M8.25 10.5V7.25a3.75 3.75 0 0 1 7.5 0v3.25" />
      )}
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width="1.5rem" height="1.5rem">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
