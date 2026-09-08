/**
 * The winding link between two milestone nodes. Each stretch bows away from
 * its reward text, so consecutive stretches lean opposite ways and the column
 * reads as a road rather than a ruler.
 *
 * Progress is a stroke dash reveal rather than a growing box, because a curve
 * cannot be a rectangle's height. `pathLength={1}` redefines the curve's
 * length as 1, which makes every dash value a plain fraction and removes any
 * need to measure the path in the DOM.
 *
 * The first stretch carries a marker at its lower end, where nothing sits
 * below it, so the road has a visible beginning instead of a floating end.
 *
 * The dot and its day numerals glide in from the start of the stretch when
 * the first day is banked, and glide onward to complete their run into the
 * milestone when it unlocks, rather than appearing and vanishing in place.
 */

import { useEffect, useId, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { SPRING_SOFT } from "../motion";

/**
 * The SVG's user units ARE css pixels. A fixed viewBox with
 * `preserveAspectRatio="none"` scaled user space away from screen space, and
 * because `vector-effect: non-scaling-stroke` computes dashes in SCREEN space
 * while `pathLength={1}` normalizes them against USER space, every dash
 * fraction came out multiplied by the ratio between the two. On a 303px
 * stretch that ratio was 0.51, so a fill at 29/30 rendered at the halfway
 * point. Matching the two spaces makes the ratio exactly 1 at any height.
 */
const CONNECTOR_W_PX = 80;

/** Shortest a stretch may draw, matching the previous floor of 6rem. */
const MIN_STRETCH_PX = 96;

/** Root coefficient, chosen so a 3-day gap lands exactly on the floor. */
const STRETCH_PX = 55.4;

/**
 * Sideways push on both control points, as a share of the width. Peak
 * deviation is three quarters of this, so 0.42 puts the bow 25.2px off centre
 * in an 80px box: the same amplitude the old 42-of-100 bend produced.
 */
const BEND_RATIO = 0.42;

/**
 * Clearance the day marker keeps from the node below it. A distance, not a
 * fraction: the dot is 8px wide and a node circle is a fixed size, so held as
 * a fraction it froze the dot for four days at each end of a 30-day stretch.
 */
const MARKER_CLEARANCE_PX = 14;

type Side = "left" | "right";

/**
 * A stretch is drawn as the square root of its gap, so a longer wait is always
 * a longer stretch without a year costing 13,000px of scrolling.
 */
function stretchHeight(gap: number): number {
  return Math.max(MIN_STRETCH_PX, STRETCH_PX * Math.sqrt(Math.max(1, gap)));
}

/** Bottom-centre to top-centre in pixels, bowed to one side. */
function curve(bendSide: Side, heightPx: number): string {
  const mid = CONNECTOR_W_PX / 2;
  const bend = BEND_RATIO * CONNECTOR_W_PX;
  const cx = bendSide === "left" ? mid - bend : mid + bend;
  return `M ${mid} ${heightPx} C ${cx} ${heightPx * 0.65} ${cx} ${heightPx * 0.35} ${mid} 0`;
}

/**
 * Where the day marker sits along the stretch. Only the node BELOW can cover
 * it — a connector paints after its own row, so the dot draws over the node
 * above, while the next row paints over the connector's bottom. So the floor
 * is real and there is no ceiling, which lets the dot sit on the fill's tip.
 *
 * Exported because the roadmap's scroll logic needs the same answer, and the
 * dot is a zero-length dash whose painted position cannot be read from the DOM.
 */
export function markerFraction(fraction: number, heightPx: number): number {
  const clamped = Math.max(0, Math.min(1, fraction));
  const inset = heightPx > 0 ? Math.min(0.4, MARKER_CLEARANCE_PX / heightPx) : 0;
  return Math.max(inset, clamped);
}

type ConnectorProps = {
  /** Both ends of this stretch are already reached. */
  traveled: boolean;
  /** This is the stretch currently being walked toward the next reward. */
  active: boolean;
  /** 0..1 progress across the active stretch. Ignored unless `active`. */
  fraction: number;
  /** Days banked toward the next reward, shown on the active marker. */
  days: number;
  /** Which side of the line the day label sits on. */
  markerSide: Side;
  /** Which way the road bows. Set opposite the reward text. */
  bendSide: Side;
  /** This is the first stretch, so its lower end is where the road begins. */
  origin: boolean;
  /** Days this stretch spans. Its drawn height follows the square root of this. */
  gap: number;
};
export default function Connector({
  traveled,
  active,
  fraction,
  days,
  markerSide,
  bendSide,
  origin,
  gap,
}: ConnectorProps) {
  const reducedMotion = useReducedMotion();
  const rampId = useId();

  const heightPx = stretchHeight(gap);
  const clamped = Math.max(0, Math.min(1, fraction));
  const marked = markerFraction(fraction, heightPx);
  const markerPct = `${marked * 100}%`;
  // Nothing banked yet means no distance travelled and no number worth showing.
  const showMarker = days >= 1;
  /** Offset that paints the curve up to `clamped`. 1 paints none, 0 paints all. */
  const progressOffset = 1 - clamped;
  /**
   * Offset that puts the dot at `marked`. The dasharray period is 2 rather
   * than 1 so both endpoints are reachable: dashes land where
   * `p + offset = 2k`, giving `p = marked` at k=1 while k=0 and k=2 fall off
   * the path. With a period of 1, an offset of 1 would put a dot on both ends
   * at once, which is what the enter and exit values below would hit.
   */
  const dotOffset = 2 - marked;
  const d = curve(bendSide, heightPx);

  const dayValue = useMotionValue(days);
  const [displayDay, setDisplayDay] = useState(days);
  useMotionValueEvent(dayValue, "change", (v) => setDisplayDay(Math.round(v)));

  useEffect(() => {
    if (!active) return;
    if (reducedMotion) {
      dayValue.jump(days);
      return;
    }
    const controls = animate(dayValue, days, SPRING_SOFT);
    return () => controls.stop();
  }, [days, active, reducedMotion, dayValue]);

  const className = [
    "connector",
    traveled ? "connector--traveled" : "",
    active ? "connector--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} style={{ width: `${CONNECTOR_W_PX}px`, height: `${heightPx}px` }}>
      <svg
        className="connector__svg"
        viewBox={`0 0 ${CONNECTOR_W_PX} ${heightPx}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {/* Pinned to the whole connector in user space, so a short reveal
              shows only the green base and amber arrives near the top. */}
          <linearGradient id={rampId} gradientUnits="userSpaceOnUse" x1={0} y1={heightPx} x2={0} y2={0}>
            <stop className="connector__ramp-start" offset="0%" />
            <stop className="connector__ramp-end" offset="100%" />
          </linearGradient>
        </defs>

        <path className="connector__base" d={d} />

        {/* A zero-length dash with a round cap, at fraction 0. The period of 2
            matters: with `0 1` the pattern would also land on fraction 1 and
            put a stray dot up at the node. */}
        {origin && (
          <path
            className="connector__origin"
            d={d}
            pathLength={1}
            strokeDasharray="0 2"
            strokeDashoffset={0}
          />
        )}

        <AnimatePresence initial={false}>
          {active && (
            <motion.path
              key="progress"
              className="connector__progress"
              d={d}
              pathLength={1}
              strokeDasharray="1 2"
              stroke={`url(#${rampId})`}
              initial={reducedMotion ? { strokeDashoffset: progressOffset } : { strokeDashoffset: 1 }}
              animate={{ strokeDashoffset: progressOffset }}
              exit={reducedMotion ? { opacity: 0 } : { strokeDashoffset: 0, opacity: 0 }}
              transition={reducedMotion ? { duration: 0 } : { ...SPRING_SOFT }}
            />
          )}
          {active && showMarker && (
            <motion.path
              key="dot"
              className="connector__dot"
              d={d}
              pathLength={1}
              strokeDasharray="0 2"
              initial={reducedMotion ? { strokeDashoffset: dotOffset } : { strokeDashoffset: 2 }}
              animate={{ strokeDashoffset: dotOffset }}
              exit={reducedMotion ? { opacity: 0 } : { strokeDashoffset: 1, opacity: 0 }}
              transition={reducedMotion ? { duration: 0 } : { ...SPRING_SOFT }}
            />
          )}
        </AnimatePresence>
      </svg>

      <AnimatePresence initial={false}>
        {active && showMarker && (
          <motion.div
            key="marker"
            className={`connector__marker connector__marker--${markerSide}`}
            initial={reducedMotion ? { bottom: markerPct } : { bottom: "0%", opacity: 0 }}
            animate={{ bottom: markerPct, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { ...SPRING_SOFT }}
          >
            <span>Day {displayDay}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
