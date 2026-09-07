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
import { SPRING, UNLOCK } from "../motion";
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
  return rect.bottom - markerFraction(fraction) * rect.height;
}

export default function Roadmap() {
  const { days, progress, milestones, next, event, claim, northstar, northstarReached, totalDays } = useNorthstar();
  const reducedMotion = useReducedMotion();
  const northstarRef = useRef<HTMLDivElement | null>(null);
  const scrolledOnMount = useRef(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (scrolledOnMount.current) return;
    scrolledOnMount.current = true;
    const scroller = scrollerRef.current;
    if (scroller === null) return;

    const y = markerViewportY(scroller, progress.fraction);
    if (y === null) {
      // Nothing left to walk, so rest on the goal it all led to.
      northstarRef.current?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      return;
    }

    const rect = scroller.getBoundingClientRect();
    scroller.scrollTop += y - (rect.top + rect.height * REST_FRACTION);
    // Runs once, on mount, against whatever the roadmap looks like at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (milestones.length === 0) {
    return (
      <div className="roadmap">
        <div className="track">
          <p className="roadmap__empty">No rewards on the roadmap yet.</p>
        </div>
      </div>
    );
  }

  const reversed = [...milestones].reverse();

  return (
    <div className="roadmap" ref={scrollerRef}>
      <LayoutGroup>
        <div className="track">
          <div>
            <div className="northstar" ref={northstarRef}>
              <div className="northstar__label">
                <span className="northstar__title">Northstar</span>
                {northstar !== "" && <span className="northstar__desc">{northstar}</span>}
                <span className="northstar__days">
                  {totalDays} {totalDays === 1 ? "day" : "days"}
                </span>
              </div>
              <div className={northstarReached ? "northstar__mark northstar__mark--reached" : "northstar__mark"}>
                <StarGlyph />
              </div>
            </div>
            <Connector
              traveled={northstarReached}
              active={false}
              fraction={0}
              days={0}
              markerSide={labelSideFor(milestones.length)}
              bendSide={oppositeSide(labelSideFor(milestones.length))}
              origin={false}
              gap={null}
            />
          </div>
          {reversed.map((entry) => {
            const traveled = entry.requirement <= days;
            const active = next !== null && entry.milestone.id === next.milestone.id;
            const justUnlocked = event?.type === "unlock" && event.milestoneId === entry.milestone.id;
            const justClaimed = event?.type === "claim" && event.milestoneId === entry.milestone.id;
            const side = labelSideFor(entry.index);
            // The road bows away from the reward text, and the day label rides the inside
            // of that bow, so numerals never sit over the curve.
            const bendSide = oppositeSide(side);

            return (
              <div key={entry.milestone.id}>
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
 * The app icon's shape: an astroid, |x|^(2/3) + |y|^(2/3) <= 1, whose four
 * concave cusps read as a north star. One cubic per quarter, with controls at
 * 0.6096R so each quarter passes through the astroid's true midpoint. Filled
 * like the icon; the reached state is carried by colour alone.
 */
function StarGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5C12 6.21 17.79 12 21.5 12C17.79 12 12 17.79 12 21.5C12 17.79 6.21 12 2.5 12C6.21 12 12 6.21 12 2.5Z" />
    </svg>
  );
}
