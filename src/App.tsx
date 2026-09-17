import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
import { useState } from "react";
import History from "./components/History";
import MilestoneEditor from "./components/MilestoneEditor";
import Roadmap from "./components/Roadmap";
import RoadmapAction from "./components/RoadmapAction";
import Settings from "./components/Settings";
import TabBar, { type Tab } from "./components/TabBar";
import { DUR, EASE_OUT } from "./motion";

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("roadmap");
  const reducedMotion = useReducedMotion();

  /**
   * The roadmap's reward editor is owned here rather than by the control that
   * opens it, because two things open it now: the bottom slot when there are no
   * rewards, and any reward on the road. One owner means the sheet can never be
   * mounted twice, and it outlives the slot flipping from "Add a reward" to
   * "Check in" underneath it.
   *
   * `editing` is the reward the sheet should open on, or null for the list as a
   * whole.
   */
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  function openEditor(milestoneId: string | null): void {
    setEditing(milestoneId);
    setEditorOpen(true);
  }

  let page: JSX.Element;
  if (tab === "roadmap") page = <Roadmap onEditReward={(id) => openEditor(id)} />;
  else if (tab === "history") page = <History />;
  else page = <Settings />;

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: DUR.fast, ease: EASE_OUT }}
          style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}
        >
          {page}
          {/* Inside the keyed subtree on purpose. Outside it, React unmounted the
              control the instant the tab changed, while the outgoing page was still
              at full opacity: the column lost the control's height, the pane grew
              into it, and the bottom-anchored roadmap jumped by exactly that much
              mid-exit. Here it leaves with the page it belongs to, so the shell's
              geometry cannot move under an animating page. */}
          {tab === "roadmap" ? <RoadmapAction onEditRewards={() => openEditor(null)} /> : null}
          {tab === "roadmap" ? (
            <MilestoneEditor open={editorOpen} focusId={editing} onClose={() => setEditorOpen(false)} />
          ) : null}
        </motion.div>
      </AnimatePresence>
      <TabBar tab={tab} onChange={setTab} />
    </>
  );
}
