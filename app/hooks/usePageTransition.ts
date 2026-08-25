import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { animate } from "motion";
import { warm } from "../lib/preload";
import { hasPendingHero } from "./useHeroFlight";

/* A navigation, as three moves.
 *
 * main.css has described this shape since the Jekyll site: "the outgoing shell
 * fades while whatever is being handed over holds still above it, the browser
 * swaps documents, and the incoming shell plays itself in around a flyer that
 * lands on its destination." The React rewrite kept only the third move. A
 * click navigated immediately, so the outgoing page did not leave — it was
 * simply replaced, and the arriving one played in over the cut. That is the
 * pop.
 *
 * So the exit is put back. The click no longer navigates; it starts the exit,
 * and navigation happens when the exit is done. The flight is what makes this
 * affordable: the card being handed over is lifted out of .shell at click time
 * (see useHeroFlight) and is therefore not part of what leaves, so the page can
 * clear out from under it without the subject of the navigation ever blinking.
 *
 * What does NOT move is as deliberate as what does. The icon row and the dots
 * are the same controls before and after — animating them out and back in would
 * say a whole page had been replaced, when the truth is that one pane changed.
 * (The opening is the exception: on a cold load they have nothing to persist
 * from, so useBootReveal plays them in with everything else.)
 */

/* Geometry and clock, shared with the opening in useBootReveal.
 *
 * These are the reference's numbers, lifted from gabrielbeaugonin.com: a 28px
 * rise over 720ms on a curve that leaves the mark almost immediately and then
 * spends the rest of its time settling. What used to be here was less than half
 * as far over two thirds the time, which is a briskness the eye reads as a
 * flick rather than a move. The slowness is the whole effect. */
export const RISE = 28;

/* The rise is written to `translate`, the standalone CSS property, and not to
   `transform`. Two of the things that have to move already carry a transform of
   their own — the dots are centred with translateY(-50%), and a card mid-flight
   is composed of one — and writing `transform` replaces those outright: the
   dots slide from the middle of the viewport to the top and snap back when the
   animation clears. `translate` composes ahead of `transform` instead, so the
   rise adds to whatever the element was already doing. */
export const REVEAL_S = 0.72;
export const EASE_REVEAL: [number, number, number, number] = [0.32, 0, 0, 1];

const EXIT_S = 0.24;
const EXIT_STAGGER = 0.018;
const ENTER_STAGGER = 0.06;

/* Past this many pieces the delay stops growing. Without the clamp the tail of
   a long prose page would still be arriving after the reader had started on
   it; with it, everything below the sixth beat lands together, which is what
   the bottom of a page looks like anyway. Clamping rather than truncating
   matters — a truncated list leaves its remainder at full opacity from the
   first frame, visibly ahead of the pieces above it. */
const STAGGER_CAP = 6;

export const rung = (step: number) => (index: number) => Math.min(index, STAGGER_CAP) * step;

/* Everything inside the panes that should be treated as a separate beat.
   Deliberately excludes .icon-row and .dots, which persist. */
const CONTENT = ".identity > *, .project__media, .prose > *, .tiles";

export const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function pieces(selector = CONTENT): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

/* Cleared onto every element the transition has touched. An element left with
   an inline opacity from a cancelled animation is an invisible page. */
export function clear(elements: HTMLElement[]) {
  for (const el of elements) {
    el.style.opacity = "";
    el.style.translate = "";
    el.style.willChange = "";
  }
}

/* The rise itself, in one place because the opening and every arrival after it
   have to be the same move — a reader who has seen the site open recognises a
   route change as the same hand only if the curve, the distance and the beat
   are identical. */
export function rise(
  elements: HTMLElement[],
  { flat = false, stagger = ENTER_STAGGER }: { flat?: boolean; stagger?: number } = {}
) {
  /* A flat rise still claims `translate`, held at zero, rather than leaving the
     property alone. The elements it plays in are the layout's own — the same
     identity nodes the exit just moved 10px up — and an animation motion is no
     longer responsible for is one whose end state it may write back to the
     inline style afterwards. Owning the property through the arrival is what
     guarantees it is at zero during it, and cleared after. */
  const controls = animate(
    elements,
    flat
      ? { opacity: [0, 1], translate: ["0px 0px", "0px 0px"] }
      : { opacity: [0, 1], translate: ["0px " + RISE + "px", "0px 0px"] },
    { duration: REVEAL_S, delay: rung(stagger), ease: EASE_REVEAL }
  );

  /* A frame after the finish, not on it. Motion commits each animation's final
     keyframe to the inline style on the frame after its promise resolves, so a
     clear that runs in the promise's own microtask is overwritten by the very
     values it was removing — the arrival ends leaving `translate: 0px` behind
     on everything it touched. */
  const settle = () => requestAnimationFrame(() => clear(elements));
  controls.finished.then(settle, settle);

  return () => {
    controls.stop();
    clear(elements);
  };
}

export function playExit(): Promise<void> {
  if (reduced()) return Promise.resolve();
  const elements = pieces();
  if (!elements.length) return Promise.resolve();
  return animate(
    elements,
    { opacity: [1, 0], translate: ["0px 0px", "0px -10px"] },
    { duration: EXIT_S, delay: rung(EXIT_STAGGER), ease: [0.4, 0, 1, 1] }
  )
    .finished.then(
      () => undefined,
      () => undefined
    );
}

export function playEnter(): (() => void) | undefined {
  if (reduced()) return;
  const elements = pieces();
  if (!elements.length) return;

  /* A page receiving a flight does not lift its hero in — the flight is already
     that motion, and a second one moving underneath it never reads as one
     gesture. It still fades, so the two are on the same clock. */
  return rise(elements, { flat: hasPendingHero() });
}

/* Navigation that waits for the page to leave before it swaps.
 *
 * Returns a `go` to call in place of letting a <Link> do its own thing. The
 * href stays on the anchor, so middle-click, ctrl-click and "open in new tab"
 * all keep working — this only takes over the plain left click.
 *
 * `warmSrc` is the image the destination is about to be flown to. It is raced
 * against the exit rather than waited on after it: a cached hero costs nothing,
 * and an uncached one is bounded by the cap in preload.ts. Landing a flight on
 * an image that has not decoded is the one blink the flight cannot hide. */
export function useTransitionNavigate() {
  const navigate = useNavigate();
  const leaving = useRef(false);

  return useCallback(
    (to: string, before?: () => void, warmSrc?: string) => {
      // A second click while the first is still leaving would run two exits and
      // navigate twice; the page is already on its way out.
      if (leaving.current) return;
      leaving.current = true;
      before?.();
      Promise.all([playExit(), warm(warmSrc)]).then(() => {
        leaving.current = false;
        navigate(to);
      });
    },
    [navigate]
  );
}

/* Plays the arriving page in. Skips the very first render: nothing left, so
   there is nothing for this to be the other half of — that one is the opening,
   and useBootReveal owns it. */
export function usePageEnter() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    return playEnter();
  }, [pathname]);
}

/* True for a click that the browser should be left to handle itself. */
export function isPlainClick(event: React.MouseEvent) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
