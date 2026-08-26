import { useEffect, useRef, type RefObject } from "react";
import {
  animate,
  motionValue,
  type AnimationPlaybackControls,
  type ValueAnimationTransition
} from "motion";
import { EASE, PAGE_S, STEP_SPRING } from "../lib/motion";

/* The home deck's position, and the only thing that moves it.
 *
 * `pos` is a float in slot units: 3.5 is halfway between card 3 and card 4.
 * useDeck paints the wheel from it every frame it changes, and that half of the
 * arrangement is untouched — what lives here is where the float comes from.
 *
 * It comes from a *step*. The deck has a whole-number cursor, and every input
 * this file understands does exactly one thing to it: add or subtract one. The
 * float is then a spring chasing that integer, never a quantity the input sets
 * directly.
 *
 * This is the reference's model (gabrielbeaugonin.com), rates and all, and it
 * is worth being explicit that it replaced a good one rather than a broken one.
 * The float used to BE the input: a wheel event moved `pos` by its own delta
 * over a fixed exchange rate, and a detent pulled the remainder to a whole card
 * when the events stopped. Nothing about that was late, and it is still the
 * more responsive of the two on paper.
 *
 * What it could not do is hold a rate. One exchange rate has to serve a mouse
 * notch (~120px, one or two per gesture), a trackpad swipe (a dense burst plus
 * a momentum tail the OS keeps sending after the fingers have lifted, several
 * hundred pixels for what the hand experienced as one flick) and a finger
 * dragging a phone screen (a few hundred pixels, and the screen is only ~700
 * tall). At 440px per card a trackpad flick crossed half the ring and a thumb
 * swipe moved barely one card. Tuning the number fixes one device by breaking
 * another, because the devices genuinely do not agree about what a pixel means.
 *
 * A step does not have that problem. Each device gets its own threshold and its
 * own rate limit, in its own units, and they all produce the same thing: one
 * card. The numbers below are the reference's.
 *
 * `pos` and the cursor both run unbounded rather than being wrapped into
 * [0, count). The ring is closed at render time by wrapOffset, so nothing needs
 * them normalised — and a position that never jumps is a position a target can
 * always be expressed against, which is the bug that wrapping it caused.
 *
 * Direction is ours, not the reference's: wheel-down and finger-up both advance,
 * which is what this site has always done and is not what was asked to change.
 * Only the rates below are lifted.
 */

/* --- Wheel -------------------------------------------------------------- */

/* Below this a wheel event is not a scroll. It is the low tail of a trackpad
   gesture, or the sideways slop in a diagonal one, and stepping a card for it
   would make the deck impossible to hold still. */
const WHEEL_MIN = 20;

/* How long the wheel is deaf after a step, as a function of how hard that step
   was pushed. This is the whole rate control, and it is inverted on purpose: a
   hard flick (a big delta) unlocks sooner and therefore travels further, a
   gentle notch waits about an eighth of a second and moves one card. Speed of
   gesture becomes distance travelled without the deck ever tracking a
   gesture's magnitude directly.

   The base is the dial: raise it and the deck holds still harder, lower it and
   a flick carries further. The reference's is 165; this is a touch quicker on
   a trackpad, where the per-event deltas are small and so the wait was long. */
const wheelCooldown = (delta: number) => Math.max(30, 130 - delta);

/* --- Pointer ------------------------------------------------------------ */

/* Finger-pixels per card. Small, because a phone screen is short and a thumb
   swipe is not: at anything like the wheel's scale a full-height drag would
   move the deck by one. The origin is reset at every step, so a long drag keeps
   stepping every 45px rather than being measured once from where it began. */
const DRAG_STEP = 45;

/* A drag that ended without ever crossing DRAG_STEP still counts if it went
   this far — the flick that is over before it is a drag. */
const FLICK_MIN = 30;

/* Floor between two steps from a pointer, and the dial that decides how far a
   thumb flick carries. A swipe is over in about a quarter of a second, so this
   — not DRAG_STEP — is what caps it: at 170 a flick got two cards no matter how
   hard it was thrown, because the third threshold arrived while the deck was
   still deaf. Below roughly 90 the steps outrun what the spring can show and
   the ring blurs, which is the floor's whole reason for existing. */
const STEP_FLOOR = 110;

/* --- Keyboard ----------------------------------------------------------- */

/* Held arrow keys autorepeat faster than the deck can read; deliberate presses
   are not throttled at all, which is why this checks `repeat` first. */
const KEY_REPEAT = 50;

export function wrapOffset(delta: number, count: number) {
  const half = count / 2;
  return (((delta + half) % count) + count) % count - half;
}

/* The reference reads `deltaY` raw, which costs it Firefox: a line-mode wheel
   reports 3, and 3 is below WHEEL_MIN, so the deck simply does not move there.
   Normalising first is invisible everywhere it agrees and correct where it
   does not. */
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

    /* The whole number every input moves, and the only thing the spring below
       ever aims at. The deck can be anywhere between two cards; it is never
       committed to anywhere but a card. */
    let cursor = Math.round(pos.get());

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

    /* Retargeting rather than restarting is the point of using a spring here.
       A second step arriving while the first is still running inherits its
       speed, so three quick notches read as one accelerating turn instead of
       three separate nudges that each begin from rest. */
    const chase = (transition: ValueAnimationTransition<number>) => {
      stop();
      if (reduceMotion) {
        pos.jump(cursor);
        return;
      }
      controls = animate(pos, cursor, transition);
    };

    const step = (direction: 1 | -1) => {
      cursor += direction;
      chase(STEP_SPRING);
    };

    /* --- Wheel ---------------------------------------------------------- */

    let wheelLock: ReturnType<typeof setTimeout> | null = null;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // pinch-zoom, not a scroll
      event.preventDefault();
      if (wheelLock) return;

      const delta = normalizeWheel(event, port);
      const size = Math.abs(delta);
      if (size < WHEEL_MIN) return;

      step(delta > 0 ? 1 : -1);
      wheelLock = setTimeout(() => {
        wheelLock = null;
      }, wheelCooldown(size));
    };

    /* --- Pointer -------------------------------------------------------- */

    /* Pointer events rather than touch events: the reference uses them, and
       they cost nothing to widen — the same handler gives a mouse the ability
       to drag the deck, which a touch-only implementation cannot. The pane
       carries `touch-action: none` in the stylesheet, so a finger's pan is the
       browser's to give away before the first move arrives. */
    const drag = {
      id: null as number | null,
      x: 0,
      y: 0,
      active: false,
      captured: false,
      stepped: false
    };
    let lastStep = 0;

    /* Every pointer-driven step goes through the floor; the keyboard's does
       not, because a key press is already one deliberate event. */
    const gated = (direction: 1 | -1) => {
      const now = performance.now();
      if (now - lastStep < STEP_FLOOR) return;
      lastStep = now;
      drag.stepped = true;
      step(direction);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag.id = event.pointerId;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.active = true;
      drag.captured = false;
      drag.stepped = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag.active || event.pointerId !== drag.id) return;
      const dy = event.clientY - drag.y;
      const dx = event.clientX - drag.x;
      // A diagonal drag belongs to whichever axis is winning, and a mostly
      // horizontal one is not for this deck at all.
      if (Math.abs(dy) <= Math.abs(dx) || Math.abs(dy) < DRAG_STEP) return;

      if (!drag.captured) {
        try {
          scroller.setPointerCapture(event.pointerId);
        } catch {
          /* The pointer is already gone. The drag still works; it just ends
             wherever the browser says it does. */
        }
        drag.captured = true;
      }
      event.preventDefault();
      gated(dy < 0 ? 1 : -1);
      // Reset, not accumulate: the next card is 45px from *here*.
      drag.x = event.clientX;
      drag.y = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!drag.active || event.pointerId !== drag.id) return;
      if (drag.captured && scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId);
      }
      if (!drag.stepped) {
        const dy = event.clientY - drag.y;
        const dx = event.clientX - drag.x;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= FLICK_MIN) {
          gated(dy < 0 ? 1 : -1);
        }
      }
      drag.id = null;
      drag.active = false;
      drag.captured = false;
      drag.stepped = false;
    };

    /* --- Targeted moves (dots, Home, End) ------------------------------- */

    const goTo = (index: number, immediate = false) => {
      // Shortest way round the loop, so card 11 -> card 0 turns forward by one.
      cursor = Math.round(pos.get() + wrapOffset(index - pos.get(), count));
      if (immediate) {
        stop();
        pos.jump(cursor);
        return;
      }
      /* Not the step spring. A dot may cross the whole ring, and the reference
         gives every move of that size its one page duration — the same clock a
         navigation runs on. */
      chase({ duration: PAGE_S, ease: EASE });
    };
    goToRef.current = goTo;

    /* --- Keyboard ------------------------------------------------------- */

    let lastKey = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (event.repeat) {
        const now = performance.now();
        if (now - lastKey < KEY_REPEAT) return;
        lastKey = now;
      }
      switch (event.key) {
        case "ArrowDown":
        case "PageDown":
          event.preventDefault();
          step(1);
          break;
        case "ArrowUp":
        case "PageUp":
          event.preventDefault();
          step(-1);
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

    /* preventDefault is the point of the wheel listener, so it cannot be
       passive. They are bound to the pane rather than the window so the rest of
       the page (the resume link, the theme toggle) keeps ordinary behaviour. */
    scroller.addEventListener("wheel", onWheel, { passive: false });
    scroller.addEventListener("pointerdown", onPointerDown, { passive: true });
    scroller.addEventListener("pointermove", onPointerMove, { passive: false });
    scroller.addEventListener("pointerup", onPointerUp, { passive: true });
    scroller.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    onPosition(pos.get());

    return () => {
      stop();
      if (wheelLock) clearTimeout(wheelLock);
      unsubscribe();
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerup", onPointerUp);
      scroller.removeEventListener("pointercancel", onPointerUp);
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
