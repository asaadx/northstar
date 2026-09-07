import { useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNorthstar } from "../store";
import { toRewardImage } from "../image";
import { DUR, EASE_OUT, SPRING_SOFT } from "../motion";

type Props = {
  open: boolean;
  onClose: () => void;
};

function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.currentTarget.blur();
}

export default function MilestoneEditor({ open, onClose }: Props) {
  const store = useNorthstar();
  const { milestones, addMilestone, updateMilestone, removeMilestone, moveMilestone } = store;
  const reducedMotion = useReducedMotion();
  const [armedId, setArmedId] = useState<string | null>(null);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="sheet__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            initial={reducedMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { y: "100%" }}
            transition={reducedMotion ? { duration: DUR.fast } : { ...SPRING_SOFT }}
          >
            <div className="sheet__handle" />
            <div className="sheet__head">
              <div className="sheet__title">Rewards</div>
              <button type="button" className="link-btn" onClick={onClose}>
                Done
              </button>
            </div>

            <AnimatePresence initial={false}>
              {milestones.map((entry, i) => {
                const { milestone, requirement } = entry;
                const armed = armedId === milestone.id;
                return (
                  <motion.div
                    className="sheet__row"
                    key={milestone.id}
                    layout={!reducedMotion}
                    transition={{ duration: DUR.base, ease: EASE_OUT }}
                    {...(reducedMotion
                      ? {}
                      : {
                          initial: { opacity: 0, height: 0 },
                          animate: { opacity: 1, height: "auto" },
                          exit: { opacity: 0, height: 0 },
                        })}
                  >
                    <div className="sheet__lead">
                      <label
                        className="sheet__thumb"
                        aria-label={milestone.image === null ? "Add a picture" : "Change the picture"}
                      >
                        <input
                          className="sheet__file"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            e.currentTarget.value = "";
                            if (file === undefined) return;
                            void toRewardImage(file)
                              .then((image) => updateMilestone(milestone.id, { image }))
                              .catch((error: unknown) => {
                                console.error("northstar: could not read that picture", error);
                              });
                          }}
                        />
                        {milestone.image === null ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="5" width="18" height="14" rx="2.5" />
                            <path d="M3 16l4.5-4.5 3.5 3.5 3-3L21 17" />
                          </svg>
                        ) : (
                          <img src={milestone.image} alt="" />
                        )}
                      </label>
                      <span className="sheet__day">{`Day ${requirement}`}</span>
                    </div>
                    <div className="sheet__fields">
                      <input
                        className="sheet__input"
                        defaultValue={milestone.reward}
                        onKeyDown={commitOnEnter}
                        onBlur={(e) => {
                          const value = e.currentTarget.value.trim();
                          if (value !== milestone.reward) updateMilestone(milestone.id, { reward: value });
                        }}
                      />
                      <input
                        className="sheet__input"
                        defaultValue={milestone.note}
                        placeholder="Note (optional)"
                        onKeyDown={commitOnEnter}
                        onBlur={(e) => {
                          const value = e.currentTarget.value.trim();
                          if (value !== milestone.note) updateMilestone(milestone.id, { note: value });
                        }}
                      />
                    </div>
                    <div className="sheet__controls">
                      {milestone.image !== null && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => updateMilestone(milestone.id, { image: null })}
                          aria-label="Remove the picture"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="5" width="18" height="14" rx="2.5" />
                            <path d="M4 20 20 4" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={i === 0}
                        onClick={() => moveMilestone(milestone.id, -1)}
                        aria-label="Move nearer"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={i === milestones.length - 1}
                        onClick={() => moveMilestone(milestone.id, 1)}
                        aria-label="Move further"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={armed ? "icon-btn icon-btn--danger" : "icon-btn"}
                        onBlur={() => setArmedId((current) => (current === milestone.id ? null : current))}
                        onClick={() => {
                          if (armed) {
                            removeMilestone(milestone.id);
                            setArmedId(null);
                          } else {
                            setArmedId(milestone.id);
                          }
                        }}
                        aria-label={armed ? "Confirm delete" : "Delete reward"}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <button type="button" className="sheet__add" onClick={() => addMilestone("New reward")}>
              Add reward
            </button>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
