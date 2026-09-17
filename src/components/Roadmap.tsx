/**
 * The centerpiece: a bottom-anchored vertical column of milestones, nearest
 * reward at the bottom, growing upward as more are added. Reflects exactly
 * where the user stands, how close the next reward is, and what has already
 * been earned — all without a single number needing to be looked up. The
 * road itself ends at a single named goal: the northstar, above the furthest
 * reward.
 *
 * The pane opens already scrolled to the walked stretch, and as progress
 * accrues and the day marker drifts toward the top edge, the view follows it
 * upward with a cushion so it never has to reach the edge to be caught.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useNorthstar } from "../store";
import type { ActiveMilestone } from "../state";
import Connector, { markerFraction } from "./Connector";
import MilestoneNode from "./MilestoneNode";
import { SPRING, UNLOCK, DUR } from "../motion";
import "../styles/roadmap.css";

/** Act while the marker is still visible, never after it has gone. */
const FOLLOW_CUSHION = 88;

/**
 * Where the marker comes to rest, as a fraction of the pane's height. Low,
 * because the road ahead is above it and the road already walked is below.
 */
const REST_FRACTION = 0.6;

/**
 * The marker's y in viewport pixels, from CSS-driven geometry only. Returns
 * null when no stretch is active, which means the roadmap is finished.
 */
function markerViewportY(scroller: HTMLElement, fraction: number): number | null {
  const active = scroller.querySelector<HTMLElement>(".connector--active");
  if (active === null) return null;
  const rect = active.getBoundingClientRect();
  return rect.bottom - markerFraction(fraction, rect.height) * rect.height;
}

type RoadmapProps = {
  /** Opens the reward editor on one reward. */
  onEditReward: (milestoneId: string) => void;
};

export default function Roadmap({ onEditReward }: RoadmapProps) {
  const { days, progress, milestones, next, event, claim } = useNorthstar();
  const empty = milestones.length === 0;
  const reducedMotion = useReducedMotion();
  const northstarRef = useRef<HTMLDivElement | null>(null);
  const positioned = useRef(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  /**
   * What the road looks like: which rewards, in what order, spaced how far
   * apart. Anything that changes this changes where the marker sits.
   */
  const shape = milestones.map((entry) => `${entry.milestone.id}:${entry.milestone.gap}`).join(",");

  // The opening position, and the only thing that reclaims it.
  //
  // Rewards can be added from this screen now, without the pane unmounting, and
  // every one of them grows the road *above* the marker while the scroller
  // stays where it was. Positioning once was not enough: the first reward
  // arrived, the pane positioned against a one-reward road, and the five that
  // followed pushed the marker back off the bottom edge — the editor closed on
  // a view parked at scrollTop 0, looking at the furthest reward.
  //
  // So this runs on every change of shape. The opening pass is unconditional,
  // as it always was. After that the marker is only reclaimed when it has been
  // pushed out of sight, because editing must not yank the view of someone
  // whose marker is already on screen.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    // An empty roadmap has nothing to position against: no stretch to measure,
    // no northstar to centre. Leave the opening pass armed for the first road.
    if (scroller === null || empty) return;
    const opening = !positioned.current;
    positioned.current = true;

    const rect = scroller.getBoundingClientRect();
    const y = markerViewportY(scroller, progress.fraction);
    if (y === null) {
      // Nothing left to walk, so rest on the goal it all led to.
      const goal = northstarRef.current;
      if (goal === null) return;
      const box = goal.getBoundingClientRect();
      if (!opening && box.bottom > rect.top && box.top < rect.bottom) return;
      goal.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      return;
    }

    if (!opening && y > rect.top && y < rect.bottom) return;
    scroller.scrollTop += y - (rect.top + rect.height * REST_FRACTION);
    // Keyed on shape alone: progress moves the marker within the road, and the
    // effect below is what follows it there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, empty]);

  const lastFollowed = useRef<string | null>(null);

  useEffect(() => {
    // Only progress moves the marker. Re-renders from anything else must not
    // interrupt someone browsing the road ahead.
    const key = `${next?.milestone.id ?? "done"}:${progress.fraction}`;
    const first = lastFollowed.current === null;
    if (lastFollowed.current === key) return;
    lastFollowed.current = key;
    if (first) return;

    const scroller = scrollerRef.current;
    if (scroller === null) return;
    const y = markerViewportY(scroller, progress.fraction);
    if (y === null) return;

    const rect = scroller.getBoundingClientRect();
    // Only the top edge is defended. Scrolling up to look ahead leaves the
    // marker low, and pulling it back would fight the user.
    if (y >= rect.top + FOLLOW_CUSHION) return;

    scroller.scrollBy({
      top: y - (rect.top + rect.height * REST_FRACTION),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [next?.milestone.id, progress.fraction, reducedMotion]);

  const reversed = [...milestones].reverse();

  return (
    <div className="roadmap" ref={scrollerRef}>
      <LayoutGroup>
        <div className="track">
          {reversed.map((entry) => {
            const traveled = entry.requirement <= days;
            const active = next !== null && entry.milestone.id === next.milestone.id;
            const justUnlocked = event?.type === "unlock" && event.milestoneId === entry.milestone.id;
            const justClaimed = event?.type === "claim" && event.milestoneId === entry.milestone.id;
            const side = labelSideFor(entry.index);
            // The road bows away from the reward text, and the day label rides the inside
            // of that bow, so numerals never sit over the curve.
            const bendSide = oppositeSide(side);
            // The furthest reward is the northstar. Nothing attaches above it,
            // so unlike a row it may stand taller than a node.
            const isNorthstar = entry.index === milestones.length - 1;

            return (
              <div key={entry.milestone.id}>
                {isNorthstar ? (
                  <div className="northstar" ref={northstarRef}>
                    <div className="northstar__label">
                      <span className="northstar__title">Northstar</span>
                      <span className="northstar__desc">{entry.milestone.reward}</span>
                      <span className="northstar__days">
                        {entry.requirement} {entry.requirement === 1 ? "day" : "days"}
                      </span>
                      {entry.status === "available" && (
                        <motion.button
                          type="button"
                          className="claim"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => claim(entry.milestone.id)}
                        >
                          Claim
                        </motion.button>
                      )}
                      {entry.status === "claimed" && (
                        <span className="northstar__status">Claimed</span>
                      )}
                    </div>
                    <motion.button
                      type="button"
                      className={
                        entry.status === "locked" ? "northstar__mark" : "northstar__mark northstar__mark--reached"
                      }
                      aria-label={`Edit ${entry.milestone.reward}`}
                      onClick={() => onEditReward(entry.milestone.id)}
                      animate={
                        (justUnlocked || justClaimed) && !reducedMotion ? { scale: [1, 1.05, 1] } : { scale: 1 }
                      }
                      transition={{ duration: DUR.base, times: [0, 0.4, 1], ease: "easeOut" }}
                    >
                      <StarGlyph />
                    </motion.button>
                  </div>
                ) : (
                  <motion.div
                    layout
                    className="row"
                  >
                    <div className="row__slot row__slot--left">
                      {side === "left" && (
                        <MilestoneLabel
                          entry={entry}
                          progressRemaining={progress.remaining}
                          isNext={active}
                          justUnlocked={!!justUnlocked}
                          reducedMotion={!!reducedMotion}
                          onClaim={() => claim(entry.milestone.id)}
                        />
                      )}
                    </div>
                    <MilestoneNode
                      status={entry.status}
                      justUnlocked={!!justUnlocked}
                      justClaimed={!!justClaimed}
                      image={entry.milestone.image}
                      onEdit={() => onEditReward(entry.milestone.id)}
                      label={entry.milestone.reward}
                    />
                    <div className="row__slot row__slot--right">
                      {side === "right" && (
                        <MilestoneLabel
                          entry={entry}
                          progressRemaining={progress.remaining}
                          isNext={active}
                          justUnlocked={!!justUnlocked}
                          reducedMotion={!!reducedMotion}
                          onClaim={() => claim(entry.milestone.id)}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
                <Connector
                  traveled={traveled}
                  active={active}
                  fraction={active ? progress.fraction : 0}
                  days={active ? progress.banked : 0}
                  markerSide={side}
                  bendSide={bendSide}
                  origin={entry.index === 0}
                  gap={entry.milestone.gap}
                />
              </div>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}

/** Labels alternate strictly by milestone index, independent of paint order. */
function labelSideFor(index: number): "left" | "right" {
  return index % 2 === 0 ? "right" : "left";
}

function oppositeSide(side: "left" | "right"): "left" | "right" {
  return side === "left" ? "right" : "left";
}

type MilestoneLabelProps = {
  entry: ActiveMilestone;
  progressRemaining: number;
  isNext: boolean;
  justUnlocked: boolean;
  reducedMotion: boolean;
  onClaim: () => void;
};

function MilestoneLabel({
  entry,
  progressRemaining,
  isNext,
  justUnlocked,
  reducedMotion,
  onClaim,
}: MilestoneLabelProps) {
  const animateEntrance = justUnlocked && !reducedMotion;
  const { status, milestone, requirement } = entry;

  return (
    <div className="label">
      <span className="label__req">{requirement} Days</span>
      <motion.span
        className={`label__reward${status === "available" ? " label__reward--available" : ""}`}
        initial={animateEntrance ? { opacity: 0, y: 4 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={animateEntrance ? { delay: UNLOCK.reward, ...SPRING } : { duration: 0 }}
      >
        {milestone.reward}
      </motion.span>
      {status === "locked" && isNext && (
        <span className="label__status">
          {progressRemaining} {progressRemaining === 1 ? "day" : "days"} to go
        </span>
      )}
      {status === "available" && (
        <motion.button
          type="button"
          className="claim"
          whileTap={{ scale: 0.95 }}
          initial={animateEntrance ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={animateEntrance ? { delay: UNLOCK.claim, ...SPRING } : { duration: 0 }}
          onClick={onClaim}
        >
          Claim
        </motion.button>
      )}
      {status === "claimed" && <span className="label__status" style={{ color: "var(--accent)" }}>Claimed</span>}
    </div>
  );
}

/**
 * The app icon's star, worn as a CSS mask rather than drawn: the shape is raster
 * artwork (`scripts/star-source.png`) and `npm run icons` emits it as the mask
 * next to the PWA icons. Masking keeps `currentColor` in charge, so the reached
 * state is still carried by colour alone, exactly as the inline path was.
 */
function StarGlyph() {
  return <span className="northstar__glyph" aria-hidden="true" />;
}
