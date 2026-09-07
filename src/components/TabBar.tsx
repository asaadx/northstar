import { motion } from "framer-motion";
import type { JSX } from "react";
import { DUR } from "../motion";

export type Tab = "roadmap" | "history" | "settings";

type TabBarProps = {
  tab: Tab;
  onChange: (tab: Tab) => void;
};

type TabDef = {
  id: Tab;
  label: string;
  icon: JSX.Element;
};

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
} as const;

const TABS: TabDef[] = [
  {
    id: "roadmap",
    label: "Roadmap",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M9 4.5 3 6.75v12.75L9 17.25l6 2.25 6-2.25V4.5l-6 2.25L9 4.5Z" />
        <path d="M9 4.5v12.75M15 6.75v12.75" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="3.25" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

export default function TabBar({ tab, onChange }: TabBarProps): JSX.Element {
  return (
    <nav className="tabbar">
      {TABS.map(({ id, label, icon }) => {
        const active = tab === id;
        return (
          <motion.button
            key={id}
            type="button"
            className={active ? "tabbar__tab tabbar__tab--active" : "tabbar__tab"}
            aria-current={active ? "page" : undefined}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: DUR.press }}
            onClick={() => onChange(id)}
          >
            <span className="tabbar__icon">{icon}</span>
            <span className="tabbar__label">{label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
