import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
import { useState } from "react";
import CheckInButton from "./components/CheckInButton";
import History from "./components/History";
import Roadmap from "./components/Roadmap";
import Settings from "./components/Settings";
import TabBar, { type Tab } from "./components/TabBar";
import { DUR, EASE_OUT } from "./motion";

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("roadmap");
  const reducedMotion = useReducedMotion();

  let page: JSX.Element;
  if (tab === "roadmap") page = <Roadmap />;
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
        </motion.div>
      </AnimatePresence>
      {tab === "roadmap" ? <CheckInButton /> : null}
      <TabBar tab={tab} onChange={setTab} />
    </>
  );
}
