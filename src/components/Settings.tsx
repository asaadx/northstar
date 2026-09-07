import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNorthstar } from "../store";
import { DUR } from "../motion";
import MilestoneEditor from "./MilestoneEditor";

export default function Settings() {
  const store = useNorthstar();
  const { days, progress, northstar, setNorthstar, reset } = store;
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <div className="page">
      <h1 className="page__title">Settings</h1>

      <div className="settings__lead">
        <span className="settings__count">{days}</span>
        <span className="settings__unit">{days === 1 ? "day" : "days"}</span>
      </div>
      <p className="settings__meta">
        {progress.remaining > 0 ? `${progress.remaining} to the next reward` : "Every reward unlocked."}
      </p>

      <div className="set-row">
        <div className="set-row__text">
          <div className="set-row__label">Northstar</div>
          <div className="set-row__note">The goal at the end of the road.</div>
        </div>
        <div className="set-row__control">
          <input
            className="sheet__input set-row__input"
            defaultValue={northstar}
            placeholder="Name it"
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onBlur={(e) => {
              const value = e.currentTarget.value.trim();
              if (value !== northstar) setNorthstar(value);
            }}
          />
        </div>
      </div>

      <div className="set-row">
        <div className="set-row__text">
          <div className="set-row__label">Rewards</div>
          <div className="set-row__note">Add, rename, reorder, or remove rewards.</div>
        </div>
        <div className="set-row__control">
          <button type="button" className="link-btn" onClick={() => setEditorOpen(true)}>
            Edit
          </button>
        </div>
      </div>

      <div className="set-row">
        <div className="set-row__text">
          <div className="set-row__label">Reset progress</div>
          <div className="set-row__note">Returns you to Day 0. Claimed rewards stay in History.</div>
        </div>
        <div className="set-row__control">
          <AnimatePresence mode="wait" initial={false}>
            {confirmingReset ? (
              <motion.div
                className="confirm"
                key="confirm"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast }}
              >
                <button type="button" className="link-btn" onClick={() => setConfirmingReset(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="link-btn link-btn--danger"
                  onClick={() => {
                    reset();
                    setConfirmingReset(false);
                  }}
                >
                  Confirm
                </button>
              </motion.div>
            ) : (
              <motion.button
                type="button"
                className="link-btn link-btn--danger"
                key="reset"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast }}
                onClick={() => setConfirmingReset(true)}
              >
                Reset
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <MilestoneEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </div>
  );
}
