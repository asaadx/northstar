import { motion, useReducedMotion } from "framer-motion";
import { earnedHistory } from "../state";
import { useNorthstar } from "../store";
import { DUR, EASE_OUT } from "../motion";

const MAX_DELAY = 0.24;

export default function History() {
  const store = useNorthstar();
  const reducedMotion = useReducedMotion();
  const groups = earnedHistory(store.state);

  if (groups.length === 0) {
    return (
      <div className="page">
        <h1 className="page__title">History</h1>
        <p className="page__empty">Nothing claimed yet. Your first reward unlocks after seven days.</p>
      </div>
    );
  }

  let rowIndex = 0;

  return (
    <div className="page">
      <h1 className="page__title">History</h1>
      {groups.map((group) => (
        <div className="history__group" key={group.run}>
          <div className="history__run">
            {`Run ${group.run}`}
            {/* Omitted entirely when unrecorded: a run that closed before this
                was tracked has no knowable count, and printing 0 would invent one. */}
            {group.days === null ? "" : ` · ${group.days} ${group.days === 1 ? "day" : "days"}`}
            {group.current ? " · current" : ""}
          </div>
          <ul className="history__list">
            {group.rewards.map((reward, i) => {
              const delay = Math.min(rowIndex * 0.04, MAX_DELAY);
              rowIndex += 1;
              const last = i === group.rewards.length - 1;
              return (
                <motion.li
                  className="history__row"
                  {...(last ? { style: { borderBottom: "none" } } : {})}
                  key={`${group.run}-${reward}-${i}`}
                  {...(reducedMotion
                    ? {}
                    : {
                        initial: { opacity: 0, y: 8 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: DUR.base, ease: EASE_OUT, delay },
                      })}
                >
                  <svg
                    className="history__check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {reward}
                </motion.li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
