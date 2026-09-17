/**
 * The roadmap's bottom control, and the only one: check in, or — when there is
 * no road to check in against — add the first reward.
 *
 * One slot rather than two controls, because a check-in that cannot reach
 * anything is a press with no consequence, and an add button floating in the
 * middle of an empty pane while the real control sat at the bottom read as the
 * lesser of the two. Both branches are the same shape in the same place, so the
 * bottom-anchored roadmap never moves when one replaces the other.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
import { DUR, SPRING } from "../motion";
import { useNorthstar } from "../store";

type RoadmapActionProps = {
  /** Opens the reward editor on the whole list. */
  onEditRewards: () => void;
};

export default function RoadmapAction({ onEditRewards }: RoadmapActionProps): JSX.Element {
  const { milestones, checkedIn, canCheckIn, checkIn, addMilestone } = useNorthstar();
  const reducedMotion = useReducedMotion();

  const empty = milestones.length === 0;

  return (
    <div className="action">
      {empty ? (
        <motion.button
          key="add"
          type="button"
          className="action__btn"
          transition={{ duration: DUR.press }}
          {...(reducedMotion ? {} : { whileTap: { scale: 0.97 } })}
          onClick={() => {
            // Create the reward here, then open the editor on it. A button
            // that only revealed another "Add reward" one layer down would be
            // a longer walk than the trip to Settings it exists to replace.
            addMilestone("New reward");
            onEditRewards();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add a reward
        </motion.button>
      ) : (
        <motion.button
          key="check-in"
          type="button"
          className={checkedIn ? "action__btn action__btn--done" : "action__btn"}
          disabled={!canCheckIn}
          onClick={checkIn}
          transition={{ duration: DUR.press }}
          {...(canCheckIn ? { whileTap: { scale: 0.97 } } : {})}
        >
          <AnimatePresence>
            {checkedIn ? (
              <motion.span
                className="action__check"
                initial={reducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
                animate={reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                transition={{ ...SPRING }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </motion.span>
            ) : null}
          </AnimatePresence>
          {checkedIn ? (canCheckIn ? "Check in again" : "Checked in") : "Check in"}
        </motion.button>
      )}
    </div>
  );
}
