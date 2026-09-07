import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
import { DUR, SPRING } from "../motion";
import { useNorthstar } from "../store";

export default function CheckInButton(): JSX.Element {
  const { checkedIn, canCheckIn, checkIn } = useNorthstar();
  const reducedMotion = useReducedMotion();

  const tapProps = canCheckIn ? { whileTap: { scale: 0.97 } } : {};

  return (
    <div className="checkin">
      <motion.button
        type="button"
        className={checkedIn ? "checkin__btn checkin__btn--done" : "checkin__btn"}
        disabled={!canCheckIn}
        onClick={checkIn}
        transition={{ duration: DUR.press }}
        {...tapProps}
      >
        <AnimatePresence>
          {checkedIn ? (
            <motion.span
              className="checkin__check"
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
    </div>
  );
}
