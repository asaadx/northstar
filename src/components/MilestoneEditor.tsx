import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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

/** Everything inside the sheet that can hold focus, in document order. */
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])';

export default function MilestoneEditor({ open, onClose }: Props) {
  const store = useNorthstar();
  const { milestones, addMilestone, updateMilestone, removeMilestone, moveMilestone, totalDays } = store;
  const reducedMotion = useReducedMotion();
  const [armedId, setArmedId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  /**
   * Whether the sheet has finished arriving. Until it has, nothing here accepts
   * a press.
   *
   * The sheet can be opened by a button sitting exactly where it enters: the
   * roadmap's "Add a reward". That press mounts the backdrop under the finger
   * while the sheet is still translated off-screen, so a second press of the
   * same spot used to land on the backdrop and dismiss the editor it had just
   * opened — leaving a reward named "New reward" and no way back in. A press
   * 50ms later again landed wherever the rising sheet happened to be, planting
   * the caret in the name or the day count and, on a phone, the keyboard with
   * it. The backdrop still swallows those presses, it just refuses to act on
   * them; the sheet ignores them outright.
   */
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (!open) setArrived(false);
  }, [open]);

  // Focus the sheet itself, not a field: this is a modal, so the keyboard has
  // to start inside it — the page behind holds a check-in button that banks a
  // day — but nothing here should raise a phone keyboard uninvited.
  useEffect(() => {
    if (open) sheetRef.current?.focus({ preventScroll: true });
  }, [open]);

  /** Escape closes; Tab cycles, so focus cannot reach the page behind. */
  function onSheetKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;

    const stops = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (first === undefined || last === undefined) return;

    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === e.currentTarget)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

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
            // Pressing the backdrop must not hand focus back to the page
            // behind: a blur to <body> puts the next Tab on the check-in
            // button, which banks a day on Enter.
            onMouseDown={(e) => e.preventDefault()}
            onClick={arrived ? onClose : undefined}
          />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Rewards"
            tabIndex={-1}
            ref={sheetRef}
            onKeyDown={onSheetKeyDown}
            style={{ pointerEvents: arrived ? "auto" : "none" }}
            initial={reducedMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { y: "100%" }}
            transition={reducedMotion ? { duration: DUR.fast } : { ...SPRING_SOFT }}
            onAnimationComplete={() => {
              if (open) setArrived(true);
            }}
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
                      <label className="sheet__gap">
                        <span className="sheet__gap-text">After</span>
                        <input
                          // Uncontrolled, like every field here: it commits on
                          // blur rather than on every keystroke. But this is
                          // the one value something else can change — deleting
                          // a reward carries its gap onto this one — and a
                          // `defaultValue` alone would keep showing the old
                          // number. Keying on the gap remounts the field with
                          // the new one; the user is never typing in it at the
                          // time, because the change comes from a delete.
                          key={milestone.gap}
                          className="sheet__input sheet__gap-input"
                          type="number"
                          min={1}
                          inputMode="numeric"
                          defaultValue={milestone.gap}
                          onKeyDown={commitOnEnter}
                          onBlur={(e) => {
                            const parsed = Number.parseInt(e.currentTarget.value, 10);
                            const gap = Number.isFinite(parsed) ? Math.max(1, parsed) : milestone.gap;
                            // Put the clamped value back so the field never shows something invalid.
                            e.currentTarget.value = String(gap);
                            if (gap !== milestone.gap) updateMilestone(milestone.id, { gap });
                          }}
                        />
                        <span className="sheet__gap-text">days later</span>
                      </label>
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

            <div className="sheet__total">
              Northstar at {totalDays} {totalDays === 1 ? "day" : "days"}
            </div>
            <button type="button" className="sheet__add" onClick={() => addMilestone("New reward")}>
              Add reward
            </button>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
