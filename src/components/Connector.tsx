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

/** viewBox units, proportional to the `--connector-w` by `--connector-h` box. */
const VB_W = 100;
const VB_H = 140;

/**
 * Sideways push on both control points. Peak deviation is `0.75 * BEND`,
 * which at 42 is 31.5 units: well inside the half-width, and it peaks
 * mid-stretch where neither node nor label reaches.
 */
const BEND = 42;

/**
 * The marker's travel is held inside this slice so it never reaches either
 * node's circle, where an opaque claimed node would cover it. The progress
 * stroke itself stays truthful to `fraction`; only the label is held back.
 */
const MARKER_FLOOR = 0.16;
const MARKER_CEILING = 0.86;

/**
 * Where the day marker sits along the stretch, as a fraction of the curve.
 * Exported because the roadmap's scroll logic needs the same answer, and the
 * dot is a zero-length dash whose painted position cannot be measured from
 * the DOM.
 */
export function markerFraction(fraction: number): number {
  const clamped = Math.max(0, Math.min(1, fraction));
  return Math.max(MARKER_FLOOR, Math.min(MARKER_CEILING, clamped));
}

type Side = "left" | "right";

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
};

/** Bottom-centre to top-centre, bowed to one side. Endpoints meet the nodes. */
function curve(bendSide: Side): string {
  const mid = VB_W / 2;
  const cx = bendSide === "left" ? mid - BEND : mid + BEND;
  return `M ${mid} ${VB_H} C ${cx} ${VB_H * 0.65} ${cx} ${VB_H * 0.35} ${mid} 0`;
}

export default function Connector({
  traveled,
  active,
  fraction,
  days,
  markerSide,
  bendSide,
  origin,
}: ConnectorProps) {
  const reducedMotion = useReducedMotion();
  const rampId = useId();

  const clamped = Math.max(0, Math.min(1, fraction));
  const marked = markerFraction(fraction);
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
  const d = curve(bendSide);

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
    <div className={className}>
      <svg
        className="connector__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {/* Pinned to the whole connector in user space, so a short reveal
              shows only the green base and amber arrives near the top. */}
          <linearGradient id={rampId} gradientUnits="userSpaceOnUse" x1={0} y1={VB_H} x2={0} y2={0}>
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
