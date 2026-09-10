# Northstar

A private, offline-first PWA for walking a year of self-chosen rewards. You
bank one day at a time by pressing a button; the road climbs from the bottom of
the screen to a single furthest reward, the northstar, that the whole thing
leads to.

No accounts, no backend, no notifications, no statistics, no analytics. Every
byte of your progress lives in your own browser's IndexedDB and never leaves the
device.

## The idea

Most streak apps advance on their own. Close them for a month, come back, and
they cheerfully report day thirty. Northstar refuses to do that. The day count
is a stored counter that moves only when you deliberately press **Check in**,
at most once per local calendar day. Skip three months and press once: you get
day two, not day ninety.

That single invariant drives most of the design, and it is asserted at the top
of `src/state.ts`:

> `days` is a stored counter. It advances only through the deliberate `checkIn`
> action, once per local calendar day. It never advances because time passed
> while the app was closed: there is no elapsed-time anchor.

The word *anchor* matters. An earlier schema stored a start date and derived the
count by measuring elapsed time from it. That is gone deliberately, parameter
and field and all, because a count assembled from wall-clock time is not a count
anyone earned.

## Milestones

A milestone is a reward you name, optionally with a note and a picture. Each one
stores a **gap** in days from the previous one, and absolute requirements are the
running sum. A fixed cadence cannot reach a year (365 does not divide by 7), and
varying gaps also match how a year actually feels: the first week needs dense
reinforcement, month nine does not.

Each milestone moves through three states:

| state | meaning |
| --- | --- |
| locked | its requirement is still ahead of `days` |
| available | requirement met, purely a function of `days` |
| claimed | you deliberately claimed it, which stamps `claimedAt` |

Unlocking is automatic and derived. Claiming is a separate, deliberate act.

**Reset** archives every claimed milestone, clears the day count, and starts a
new run. Milestones never claimed stay on the road and renumber, so the old
14-day node becomes the 7-day one. Archived milestones are never deleted; they
are what History reads.

**History** groups claimed rewards by run, newest first, and shows the day count
each run reached. Runs closed before that was recorded show no count rather
than a fabricated zero.

## The road

The vertical roadmap is the part with the most work in it.

- Each stretch between two rewards is an SVG curve bowing away from its reward
  text, so consecutive stretches lean opposite ways and the column reads as a
  road rather than a list.
- Stretch height is the **square root** of the gap. Uniform heights swing
  pixels-per-day 22x across a year; linear heights even that out but cost a
  13,000px track. Square root compresses the spread to 4.6x in 4,765px.
- Each connector builds its `viewBox` from its own pixel size, so user units are
  CSS pixels and dash fractions map exactly to progress at any height. Mixing
  `pathLength={1}` (user space) with `vector-effect: non-scaling-stroke`
  (screen space) previously drew a 29/30 fill at the halfway point.
- The day marker is a zero-length dash with a round cap, inset by a fixed 14px
  clearance rather than a fraction of the stretch, so it never freezes behind a
  node circle on a long gap.
- Reward pictures are centre-cropped, capped at 256px, and stored as a WebP (or
  JPEG) data URL, because the entire state record is rewritten on every
  check-in.
- `prefers-reduced-motion` is respected throughout.

## Stack

React 19, TypeScript, Vite 5, framer-motion. No state library: `src/store.ts` is
a hand-rolled external store read through `useSyncExternalStore`. No router.
No backend of any kind.

| file | role |
| --- | --- |
| `src/state.ts` | pure, immutable state model and every transition |
| `src/store.ts` | subscription, persistence, midnight rollover, animation events |
| `src/db.ts` | IndexedDB: the whole state under a single key |
| `src/components/` | roadmap, connectors, nodes, history, settings, tab bar |
| `public/sw.js` | cache-first service worker, same-origin requests only |
| `scripts/gen-icons.mjs` | rasterizes every app icon from `star-source.png` |

## Running it

```sh
npm install
npm run dev        # vite dev server on :5173
npm run build      # tsc --noEmit && vite build
npm run preview    # serve the production build
npm run typecheck
npm run icons      # regenerate public/icons from scripts/star-source.png
```

Development behaves differently on purpose, all of it gated on
`import.meta.env.DEV` so it is eliminated from a production bundle:

- a **separate IndexedDB database** (`northstar-dev`), wiped once per dev-server
  run, so testing can never reach real data
- **repeat check-ins allowed**, so the check-in and unlock sequences can be
  exercised without waiting for tomorrow
- a **seeded thirteen-step roadmap** with gaps summing to 365, so there is
  something real to judge scrolling against

A production build opens on an **empty roadmap**. Naming rewards is personal, so
a real roadmap starts empty rather than presuming someone else's.

## Deploying

The app is a static bundle. `base` is read from `NORTHSTAR_BASE`, which must
match the path it is served from:

```sh
npm run build                                 # root domain
NORTHSTAR_BASE=/northstar/ npm run build      # GitHub Pages project site
```

Icon filenames are unhashed and the service worker serves assets cache-first, so
bump `CACHE` in `public/sw.js` when shipping new icons; `activate` drops every
cache that is not current.

## Data and privacy

Everything is local. There is no server, no account, no telemetry, and the
service worker refuses any request whose origin is not its own. Clearing site
data or uninstalling the PWA deletes your progress, and there is no export yet.

`DB_VERSION` in `src/db.ts` is bumped only to **discard** stored records rather
than migrate them. `hydrate` in `src/state.ts` carries forward every earlier
shape worth keeping, field by field, so a bump there is a deliberate decision to
start over.

## License

MIT. See [LICENSE](LICENSE).
