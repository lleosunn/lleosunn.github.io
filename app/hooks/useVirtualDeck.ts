import { useEffect, useRef, type RefObject } from "react";
import { animate, cancelFrame, frame, motionValue, type AnimationPlaybackControls } from "motion";

/* The home deck's position, and the only thing that moves it.
 *
 * The pane used to be a real scroll container: 36 full-height slots, Lenis
 * smoothing scrollTop, and a snap that fired on `scrollend` and dragged the
 * nearest card the rest of the way in. That last part is what read as choppy —
 * the snap was a *second* animation that could only start once the first had
 * completely stopped, so every notch was glide, pause, correct.
 *
 * There is no scroll container here at all. `pos` is a float in slot units:
 * 3.5 is halfway between card 3 and card 4.
 *
 * While input is arriving the deck IS the input. A wheel event moves `pos` by
 * exactly its own delta, on the frame it arrives — no threshold to cross, no
 * animation in between, nothing to be late. It can rest between two cards for
 * as long as a finger is still moving.
 *
 * The moment input stops, one no-bounce spring carries it to a whole card. How
 * fast the gesture was going decides which card that is, so a flick travels and
 * a nudge settles next door. It never overshoots: the destination is chosen
 * first and the spring only ever decelerates into it.
 *
 * (This replaced a model that moved in whole cards only, accumulating delta
 * until it was worth one. On a mouse that was invisible — a notch is 120px and
 * clears the bar on its own. On a trackpad it was a 56px dead zone: a gentle
 * scroll produced literally no movement, and a medium one did not start for
 * 210ms. Tracking the input directly is the only thing that has no latency to
 * tune, because there is nothing between the event and the paint.)
 *
 * `pos` runs unbounded rather than being wrapped into [0, count). The ring is
 * closed at render time by wrapOffset, so nothing needs it normalised — and a
 * position that never jumps is a position a target can always be expressed
 * against, which is the bug that wrapping it caused.
 */

/* Wheel pixels that make up one card of travel, and the 1:1 exchange rate while
   a gesture is running.

   Tuned for a trackpad, because that is what this is mostly used with and the
   two devices are nothing alike. A mouse notch is ~120px and a gesture is one
   or two of them. A macOS trackpad swipe is a dense burst plus a momentum tail
   the OS keeps sending after the fingers have lifted, and it adds up to several
   hundred pixels for what the hand experienced as one flick. At 180 — a
   sensible number for a mouse — that same flick crossed half the ring. */
const SLOT_PX = 440;

/* Stiffness of the pull toward the card the deck is currently committed to.
   This force is never switched on or off; it acts on every frame, which is the
   whole point. There is no moment when the deck is resting somewhere and
   waiting to be told to snap, because it has been falling toward a card the
   entire time. */
const AIM_K = 320;

/* Just past critical. Critical alone is the fastest approach that cannot
   oscillate, but a spring entering with speed already pointed at its target can
   still cross it once; the margin buys that back. Anything much higher is
   simply slow. */
const AIM_DAMP = 1.08;

/* How far ahead of itself a moving deck aims, in seconds of travel. This is
   what lets a spin pass cards rather than being caught by the first one: while
   there is speed the committed card keeps being recomputed further along, and
   as the speed dies the projection shrinks to nothing and the aim converges on
   whatever the deck is nearest.

   Critically, the aim is a *fixed* target on any given frame. Pulling toward
   round(pos) instead — the nearest card, recomputed from position alone — is
   what a detent literally is, and it was the first thing tried here. It has a
   flaw the spring cannot damp out: the target flips the moment the deck crosses
   a midpoint, so a slow arrival near a boundary gets pulled backwards, which
   measured as a small but real overshoot. A target that only moves with speed,
   and stops moving before the deck arrives, cannot do that. */
const AIM_PROJECT = 0.06;

/* The aim is set from input and from nothing else — never from the deck's own
   velocity on a later frame. That distinction is the whole stability argument.
   Re-deriving it per frame from the current speed reads as the obvious way to
   let a spin keep travelling, and it runs away: the spring accelerates the deck
   toward the aim, the faster deck projects the aim further off, and the two
   feed each other until the ring is spinning and nothing can land. Input is a
   bounded source. The spring's own output is not. */

const VELOCITY_WINDOW_MS = 100;

/* Below these the card is centred to the eye — 0.002 of a slot is under half a
   pixel — and chasing a remainder finer than that only keeps a frame loop alive
   behind a pane that has visibly stopped. Tighter thresholds measurably lengthen
   the settle without changing anything anyone can see. */
const REST_POS = 0.002;
const REST_VEL = 0.012;

/* A tab restored after being backgrounded reports one enormous delta; clamped
   so it cannot launch the deck across the ring in a single step. */
const MAX_DT = 1 / 30;

/* A dot or an arrow key is a deliberate jump rather than the tail of a gesture,
   and may cross the whole ring, so it is allowed a little longer to read. */
const TARGET_BASE = 0.22;
const TARGET_PER_CARD = 0.05;
const TARGET_MAX = 0.45;

export function wrapOffset(delta: number, count: number) {
  const half = count / 2;
  return (((delta + half) % count) + count) % count - half;
}

function normalizeWheel(event: WheelEvent, port: number) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * port;
  return event.deltaY;
}

export interface VirtualDeckOptions {
  scrollerRef: RefObject<HTMLElement | null>;
  count: number;
  enabled: boolean;
  /* Read every frame the position changes. Kept as a callback rather than React
     state on purpose: routing a transform through a render on every frame is
     the one thing that would make this worse than what it replaces. */
  onPosition: (pos: number) => void;
  onActive: (index: number) => void;
  initialIndex?: number;
}

export interface VirtualDeck {
  /* Travels to an absolute card index by the shortest way round the loop. */
  goToIndex: (index: number, immediate?: boolean) => void;
  positionRef: RefObject<number>;
  activeRef: RefObject<number>;
}

export function useVirtualDeck({
  scrollerRef,
  count,
  enabled,
  onPosition,
  onActive,
  initialIndex = 0
}: VirtualDeckOptions): VirtualDeck {
  const positionRef = useRef(initialIndex);
  const activeRef = useRef(initialIndex);
  const goToRef = useRef<(index: number, immediate?: boolean) => void>(() => {});

  useEffect(() => {
    if (!enabled || !count) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pos = motionValue(positionRef.current);
    let controls: AnimationPlaybackControls | null = null;
    let port = scroller.clientHeight || window.innerHeight;

    const unsubscribe = pos.on("change", (value: number) => {
      positionRef.current = value;
      onPosition(value);
      const index = ((Math.round(value) % count) + count) % count;
      if (index !== activeRef.current) {
        activeRef.current = index;
        onActive(index);
      }
    });

    const stop = () => {
      controls?.stop();
      controls = null;
    };

    /* The only animation this hook runs. `to` is always a whole card and the
       spring is always bounce-free, so the deck decelerates into it and stays
       there rather than passing it and coming back. */
    const travel = (to: number, base: number, perCard: number, max: number) => {
      const distance = Math.abs(to - pos.get());
      // Nothing to do — and say so, because the caller has suspended the frame
      // loop on the promise this would otherwise never produce.
      if (distance < 1e-4) return false;
      stop();
      controls = animate(pos, to, {
        type: "spring",
        bounce: 0,
        visualDuration: Math.min(max, base + perCard * distance)
      });
      return true;
    };

    /* --- Velocity ------------------------------------------------------- */

    /* Sampled from the positions the input actually produced rather than from
       the raw deltas, so the wheel and a dragging finger are measured the same
       way and land the same way. */
    let samples: Array<{ t: number; p: number }> = [];

    const sample = (p: number) => {
      const now = performance.now();
      samples.push({ t: now, p });
      while (samples.length > 2 && now - samples[0].t > VELOCITY_WINDOW_MS) samples.shift();
    };

    const velocity = () => {
      if (samples.length < 2) return 0;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const seconds = (last.t - first.t) / 1000;
      return seconds > 0 ? (last.p - first.p) / seconds : 0;
    };

    /* --- The loop ------------------------------------------------------- */

    let vel = 0;
    let aim = Math.round(pos.get());
    let running = false;
    /* Raised only while a dot or an arrow key is driving. Two things pulling
       the same value at once is a fight the user can see, so the detent stands
       down for the length of a deliberate jump. */
    let driving = false;

    const tick = ({ delta }: { delta: number }) => {
      if (driving) return;
      const dt = Math.min(delta, MAX_DT * 1000) / 1000;
      const here = pos.get();

      const c = AIM_DAMP * 2 * Math.sqrt(AIM_K);
      vel += (AIM_K * (aim - here) - c * vel) * dt;
      const next = here + vel * dt;

      if (Math.abs(next - aim) < REST_POS && Math.abs(vel) < REST_VEL) {
        // The only exit. Whatever happened before it, the deck stops on a card.
        vel = 0;
        pos.jump(aim);
        halt();
        return;
      }
      pos.jump(next);
    };

    const run = () => {
      if (running) return;
      running = true;
      frame.update(tick, true);
    };

    const halt = () => {
      if (!running) return;
      running = false;
      cancelFrame(tick);
    };

    /* --- Wheel ---------------------------------------------------------- */

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // pinch-zoom, not a scroll
      event.preventDefault();

      // The hand is back on the wheel; a targeted move gives way to it.
      stop();
      driving = false;

      // jump(), not set(): this is the input itself, not something to ease to.
      const next = pos.get() + normalizeWheel(event, port) / SLOT_PX;
      pos.jump(next);
      sample(next);
      /* While input is arriving the input defines the speed; the integrator
         only takes the value over once the events stop coming. */
      vel = velocity();
      aim = Math.round(next + vel * AIM_PROJECT);
      run();
    };

    /* --- Touch ---------------------------------------------------------- */

    let dragging = false;
    let dragId: number | null = null;
    let dragFrom = 0;
    let dragPos = 0;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      stop();
      driving = false;
      halt();
      vel = 0;
      dragging = true;
      dragId = touch.identifier;
      dragFrom = touch.clientY;
      dragPos = pos.get();
      aim = Math.round(dragPos);
      samples = [];
      sample(dragPos);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!dragging) return;
      const touch = Array.from(event.changedTouches).find((t) => t.identifier === dragId);
      if (!touch) return;
      event.preventDefault();
      // 1:1 with the finger: dragging up moves the deck forward.
      const next = dragPos + (dragFrom - touch.clientY) / SLOT_PX;
      pos.jump(next);
      sample(next);
    };

    /* Nothing is decided here. The finger's last speed is handed to the same
       integrator that has been running all along, and the throw simply carries
       on into whichever card it runs out on. */
    const release = () => {
      if (!dragging) return;
      dragging = false;
      dragId = null;
      vel = velocity();
      aim = Math.round(pos.get() + vel * AIM_PROJECT);
      samples = [];
      run();
    };

    /* --- Targeted moves (dots, keyboard) -------------------------------- */

    const goTo = (index: number, immediate = false) => {
      samples = [];
      vel = 0;
      halt();
      aim = Math.round(pos.get());
      // Shortest way round the loop, so card 11 -> card 0 turns forward by one.
      const to = pos.get() + wrapOffset(index - pos.get(), count);
      if (immediate || reduceMotion) {
        stop();
        driving = false;
        pos.jump(to);
        return;
      }
      driving = true;
      if (!travel(to, TARGET_BASE, TARGET_PER_CARD, TARGET_MAX)) {
        /* Already there. Releasing the loop here is not a nicety: `driving`
           suspends the integrator, and a target that never animates has no
           `finished` to lower it again — the deck would simply stop responding
           to the wheel from then on. */
        driving = false;
        return;
      }
      controls!.finished.then(
        () => { driving = false; },
        () => { driving = false; }
      );
    };
    goToRef.current = goTo;

    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const here = Math.round(pos.get());
      const index = ((here % count) + count) % count;
      /* Wrapped before it is asked for, not after. goTo takes the shortest way
         round to a card *index*, so handing it `count` is handing it card 0 —
         the one the deck is already on when index is count-1 — and the arrow
         key does nothing at the exact moment it is most obviously supposed to
         work, stepping off the end of the ring. */
      const step = (n: number) => goTo(((n % count) + count) % count);
      switch (event.key) {
        case "ArrowDown":
        case "PageDown":
          event.preventDefault();
          step(index + 1);
          break;
        case "ArrowUp":
        case "PageUp":
          event.preventDefault();
          step(index - 1);
          break;
        case "Home":
          event.preventDefault();
          goTo(0);
          break;
        case "End":
          event.preventDefault();
          goTo(count - 1);
          break;
        default:
          return;
      }
    };

    const onResize = () => {
      port = scroller.clientHeight || window.innerHeight;
      onPosition(pos.get());
    };

    /* preventDefault is the point of both of these, so neither can be passive.
       They are bound to the pane rather than the window so the rest of the page
       (the resume link, the theme toggle) keeps ordinary behaviour. */
    scroller.addEventListener("wheel", onWheel, { passive: false });
    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", release, { passive: true });
    scroller.addEventListener("touchcancel", release, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    onPosition(pos.get());

    return () => {
      stop();
      halt();
      unsubscribe();
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", release);
      scroller.removeEventListener("touchcancel", release);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      goToRef.current = () => {};
    };
  }, [scrollerRef, count, enabled, onPosition, onActive]);

  return {
    goToIndex: (index: number, immediate?: boolean) => goToRef.current(index, immediate),
    positionRef,
    activeRef
  };
}
