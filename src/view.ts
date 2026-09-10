import {
  activeMilestones,
  earnedHistory,
  nextMilestone,
  type ActiveMilestone,
  type State,
} from "./state";

export type Tab = "roadmap" | "history" | "settings";

export type Ui = {
  tab: Tab;
  days: number;
};

export type Actions = {
  setTab: (tab: Tab) => void;
  addDay: () => void;
  reset: () => void;
  openEditor: () => void;
};

/** Shared DOM factory: every element in this module is built through it. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ------------------------------------------------------------------ roadmap */

const LOCK_SVG =
  '<svg class="node__lock" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />' +
  '<path d="M8.25 10.5V7.25a3.75 3.75 0 0 1 7.5 0v3.25" /></svg>';

/**
 * The nearest milestone is the roadmap's starting point, so it always reads as
 * done even before any day is banked.
 */
function isReached(entry: ActiveMilestone, days: number): boolean {
  return days >= entry.requirement || entry.index === 0;
}

function renderNode(entry: ActiveMilestone, isNext: boolean, days: number): HTMLElement {
  const { milestone } = entry;
  const reached = isReached(entry, days);

  const node = el("div", `node ${reached ? "node--unlocked" : "node--locked"}`);
  if (isNext) node.classList.add("node--next");
  node.dataset.milestoneId = milestone.id;
  node.setAttribute("aria-label", reached ? "unlocked" : "locked");
  // Static markup, no interpolation.
  if (!reached) node.innerHTML = LOCK_SVG;

  return node;
}

/**
 * Wraps a node in a symmetric 3-column row so the day-count/reward label can
 * sit beside the circle without ever shifting the circle off-centre: both
 * slots always exist, only one of them ever holds content.
 */
function renderRow(entry: ActiveMilestone, isNext: boolean, days: number): HTMLElement {
  const { milestone, requirement } = entry;
  const reached = isReached(entry, days);

  const row = el("div", "row");
  if (reached) row.classList.add("row--reached");
  if (isNext) row.classList.add("row--next");

  const label = el("div", "label");
  label.append(el("p", "label__days", `${requirement} Days`));
  if (milestone.reward !== "") {
    label.append(el("p", "label__reward", milestone.reward));
  }

  const left = el("div", "row__slot row__slot--left");
  const right = el("div", "row__slot row__slot--right");
  if (entry.index % 2 === 0) {
    right.append(label);
  } else {
    left.append(label);
  }

  row.append(left, renderNode(entry, isNext, days), right);
  return row;
}

function renderRoadmap(state: State, ui: Ui, actions: Actions): HTMLElement {
  const entries = activeMilestones(state);
  const roadmap = el("main", "roadmap");

  if (entries.length === 0) {
    const empty = el("div", "empty");
    empty.append(el("p", "empty__text", "No milestones on the roadmap."));
    const add = el("button", "btn btn--primary", "Add milestones");
    add.type = "button";
    add.addEventListener("click", actions.openEditor);
    empty.append(add);
    roadmap.append(empty);
    return roadmap;
  }

  const track = el("div", "track");
  const next = nextMilestone(state);

  // Rendered furthest-first: up the page is progress, down is regression.
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!;
    track.append(renderRow(entry, entry.index === next?.index, ui.days));

    if (i > 0) {
      // Segment between this node and the one below it. Solid green once both
      // ends are done; green-to-yellow while it climbs toward the next one.
      const lower = entries[i - 1]!;
      const state$ = isReached(lower, ui.days)
        ? isReached(entry, ui.days)
          ? "connector--lit"
          : "connector--active"
        : "";
      track.append(el("div", `connector ${state$}`));
    }
  }

  roadmap.append(track);
  return roadmap;
}

/* ------------------------------------------------------------------ history */

function renderHistory(state: State): HTMLElement {
  const page = el("main", "page");
  page.append(el("h1", "page__title", "History"));

  const groups = earnedHistory(state);
  if (groups.length === 0) {
    page.append(
      el(
        "p",
        "page__empty",
        "Nothing earned yet. Bank seven days to unlock your first reward.",
      ),
    );
    return page;
  }

  for (const group of groups) {
    const section = el("section", "run");
    const name = `Run ${group.run}${group.current ? " · in progress" : ""}`;
    section.append(el("h2", "run__name", name));

    const list = el("ul", "run__list");
    for (const reward of group.rewards) {
      list.append(el("li", "run__reward", reward));
    }
    section.append(list);
    page.append(section);
  }

  return page;
}

/* ----------------------------------------------------------------- settings */

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function renderRowItem(label: string, note: string | null, control: HTMLElement): HTMLElement {
  const row = el("div", "row-item");
  const text = el("div", "row-item__text");
  text.append(el("p", undefined, label));
  if (note !== null) text.append(el("p", "row-item__note", note));
  row.append(text, control);
  return row;
}

function renderSettings(state: State, ui: Ui, actions: Actions): HTMLElement {
  const page = el("main", "page");
  page.append(el("h1", "page__title", "Settings"));

  const stat = el("div", "stat");
  const count = el("div", "stat__count");
  const unit = ui.days === 1 ? "day" : "days";
  count.append(document.createTextNode(`${ui.days} `));
  count.append(el("span", "stat__unit", unit));
  stat.append(count);
  // There is no start anchor by design, so the honest date to show is the
  // last check-in actually banked rather than a date derived from elapsed time.
  const meta =
    state.lastCheckIn === null
      ? "No check-ins yet"
      : `Last check-in ${DATE_FORMAT.format(new Date(state.lastCheckIn))}`;
  stat.append(el("p", "stat__meta", meta));
  page.append(stat);

  const editBtn = el("button", "btn btn--ghost", "Edit");
  editBtn.type = "button";
  editBtn.addEventListener("click", actions.openEditor);
  page.append(renderRowItem("Milestones", null, editBtn));

  const addDayBtn = el("button", "btn btn--ghost", "+1 ");
  addDayBtn.type = "button";
  addDayBtn.addEventListener("click", actions.addDay);
  page.append(
    renderRowItem("Add a day", "Manually bank one more day if the count is wrong.", addDayBtn),
  );

  const resetBtn = el("button", "btn btn--danger", "Reset");
  resetBtn.type = "button";
  resetBtn.addEventListener("click", actions.reset);
  page.append(
    renderRowItem(
      "Reset streak",
      "Archives unlocked milestones and returns you to zero.",
      resetBtn,
    ),
  );

  return page;
}

/* -------------------------------------------------------------------- tabs */

const TAB_ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
  ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const TAB_ICONS: Record<Tab, string> = {
  roadmap:
    `<svg ${TAB_ICON_ATTRS}><path d="M9 4.5 3 6.75v12.75L9 17.25l6 2.25 6-2.25V4.5l-6 2.25L9 4.5Z" />` +
    '<path d="M9 4.5v12.75M15 6.75v12.75" /></svg>',
  history:
    `<svg ${TAB_ICON_ATTRS}><circle cx="12" cy="12" r="9" />` +
    '<path d="M12 7.5V12l3 2" /></svg>',
  settings:
    `<svg ${TAB_ICON_ATTRS}><circle cx="12" cy="12" r="3.25" />` +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>',
};

const TAB_LABELS: Record<Tab, string> = {
  roadmap: "Roadmap",
  history: "History",
  settings: "Settings",
};

const TAB_ORDER: Tab[] = ["roadmap", "history", "settings"];

function renderTabBar(ui: Ui, actions: Actions): HTMLElement {
  const nav = el("nav", "tabbar");
  for (const tab of TAB_ORDER) {
    const active = tab === ui.tab;
    const button = el("button", `tabbar__tab${active ? " tabbar__tab--active" : ""}`);
    button.type = "button";
    if (active) button.setAttribute("aria-current", "page");
    const icon = el("span", "tabbar__icon");
    icon.innerHTML = TAB_ICONS[tab];
    button.append(icon, el("span", "tabbar__label", TAB_LABELS[tab]));
    button.addEventListener("click", () => {
      actions.setTab(tab);
    });
    nav.append(button);
  }
  return nav;
}

/* --------------------------------------------------------------------- root */

export function render(root: HTMLElement, state: State, ui: Ui, actions: Actions): void {
  const previousScroll =
    ui.tab === "roadmap" ? (root.querySelector(".roadmap")?.scrollTop ?? null) : null;

  const page =
    ui.tab === "roadmap"
      ? renderRoadmap(state, ui, actions)
      : ui.tab === "history"
        ? renderHistory(state)
        : renderSettings(state, ui, actions);

  root.replaceChildren(page, renderTabBar(ui, actions));

  if (ui.tab !== "roadmap") return;

  const roadmap = root.querySelector<HTMLElement>(".roadmap");
  if (roadmap === null) return;

  if (previousScroll !== null) {
    roadmap.scrollTop = previousScroll;
    return;
  }

  // First paint: park the viewport on the milestone being worked toward.
  // Every milestone unlocked -> no `.node--next`; fall back to the furthest
  // milestone, which renders first (at the top of the page).
  const focus =
    roadmap.querySelector<HTMLElement>(".node--next") ??
    roadmap.querySelector<HTMLElement>(".node:first-child");
  focus?.scrollIntoView({ block: "center" });
}
