import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { animate, type AnimationPlaybackControls } from "motion";
import { EASE, LINE, PAGE_S, RISE } from "../lib/motion";
import { splitLines, splittable, type Split } from "../lib/splitLines";
import { warm } from "../lib/preload";
import { hasPendingHero } from "./useHeroFlight";

/* A navigation, as two moves that happen at once.
 *
 * It used to be three that happened in turn: the click started an exit, the
 * exit finished, and only then did the route change and the arriving page play
 * itself in. That ordering is what read as unsmooth, and not because any single
 * part of it was slow. Between the moment the outgoing page had finished
 * leaving and the moment the incoming one had anything to show, there was a
 * quarter of a second in which the only thing on screen was a copy of the
 * clicked card holding perfectly still. A gap in the middle of a gesture is
 * more noticeable than a slow gesture.
 *
 * The reference (gabrielbeaugonin.com) has no such gap because it never waits.
 * The click navigates on the spot; the outgoing page stays mounted and fades
 * over the full page duration *underneath* the incoming one, which is rising
 * into place at the same time, while the card morphs across the top of both.
 * Three things are moving throughout and none of them is waiting for another.
 *
 * The retention is the layout's job (see routes/layout.tsx, which keeps the
 * leaving route's element around and fades it). What is left here is the
 * arrival: the rise for pieces that are pictures, and the masked line reveal
 * for the pieces that are type.
 *
 * What does NOT move is as deliberate as what does. The icon row and the dots
 * are the same controls before and after — animating them out and back in would
 * say a whole page had been replaced, when the truth is that one pane changed.
 * (The opening is the exception: on a cold load they have nothing to persist
 * from, so useBootReveal plays them in with everything else.)
 */

/* The rise is written to `translate`, the standalone CSS property, and not to
   `transform`. Two of the things that have to move already carry a transform of
   their own — the dots are centred with translateY(-50%), and a card mid-flight
   is composed of one — and writing `transform` replaces those outright: the
   dots slide from the middle of the viewport to the top and snap back when the
   animation clears. `translate` composes ahead of `transform` instead, so the
   rise adds to whatever the element was already doing. */

/* The page that is on its way in, as opposed to the copy of the last one that
   is still fading over the top of it. Every selector an arrival uses has to say
   so: both are in the document at once now, and a reveal that swept up the
   outgoing page's paragraphs would split the very DOM that is being thrown
   away — and animate it in while it fades out. */
export const LIVE = ".pane-page:not(.pane-ghost)";

/* Everything inside the panes that should be treated as a separate beat.
   Deliberately excludes .icon-row and .dots, which persist. */
const CONTENT = [
  `${LIVE} .project__media`,
  `${LIVE} .prose > *`,
  `${LIVE} .tiles`
].join(", ");

/* Past this many blocks the delay stops growing. The reference does not need a
   cap because its longest page is six paragraphs; a project page here can be
   thirty, and at a quarter of a second each the last one would arrive eight
   seconds after the first. Clamping rather than truncating matters — a
   truncated list leaves its remainder at full opacity from the first frame,
   visibly ahead of the pieces above it. */
const STAGGER_CAP = 6;

/* How far past the fold a piece may be and still be part of the arrival. The
   reference's own overshoot: a block a little below the fold is close enough
   that the reader will scroll to it while the page is still settling, and one
   further down than that is a block they will meet cold minutes later, where an
   animation is not an arrival but an interruption. */
const FOLD = 1.12;

export const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function pieces(selector = CONTENT): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

/* Cleared onto every element the transition has touched. An element left with
   an inline opacity from a cancelled animation is an invisible page.

   The attribute goes too, not just the properties. Clearing them leaves
   `style=""` behind, which is invisible on screen and not invisible at all in
   `innerHTML` — and .prose blocks have their markup snapshotted and put back by
   the line reveal, so a stray empty attribute is the difference between the
   page ending up byte-identical to what the build wrote and merely looking like
   it. Only when nothing else is set: a few of these posts carry hand-authored
   inline styles that are the author's, not ours. */
export function clear(elements: HTMLElement[]) {
  for (const el of elements) {
    el.style.opacity = "";
    el.style.translate = "";
    el.style.willChange = "";
    if (!el.style.length) el.removeAttribute("style");
  }
}

function onScreen(el: HTMLElement): boolean {
  const scroller = document.getElementById("scroller");
  const fold = (scroller?.clientHeight || window.innerHeight) * FOLD;
  const box = el.getBoundingClientRect();
  return box.top < fold && box.bottom > -fold;
}

export interface RevealOptions {
  /* Seconds before this group's first piece moves. */
  delay?: number;
  /* Seconds between one block and the next. */
  stagger?: number;
  /* A page receiving a flight does not lift the picture the flight is landing
     on — the flight is already that motion, and a second one moving underneath
     it never reads as one gesture. Its type still reveals normally. */
  flat?: boolean;
}

export interface Reveal {
  play: () => void;
  stop: () => void;
}

/* Held first, played second.
 *
 * The two are separate because the opening needs to do something between them:
 * the curtain data-boot holds up can only come off once every piece behind it
 * is already sitting at its start state, or the frame in between is the flash
 * the curtain exists to prevent. A route arrival simply does both at once.
 *
 * Splitting is part of the hold, not the play, for the same reason — a block
 * that is visible for one frame before its lines are masked is a block that
 * flickers. */
export function reveal(elements: HTMLElement[], options: RevealOptions = {}): Reveal {
  const { delay = 0, stagger = LINE.blockStagger, flat = false } = options;

  if (reduced()) {
    return { play: () => clear(elements), stop: () => clear(elements) };
  }

  const media: HTMLElement[] = [];
  const splits: Split[] = [];
  const touched = [...elements];

  for (const el of elements) {
    if (!onScreen(el)) continue;
    if (splittable(el)) {
      const split = splitLines(el);
      if (split) {
        for (const line of split.lines) {
          line.style.translate = `0px ${LINE.from}`;
          line.style.willChange = "translate";
        }
        /* Type does not fade, so whatever was hiding the block has to go now
           rather than being animated away — the masks are what hide it from
           here on. */
        el.style.opacity = "1";
        splits.push(split);
        continue;
      }
    }
    el.style.opacity = "0";
    if (!flat) el.style.translate = `0px ${RISE}px`;
    el.style.willChange = "translate, opacity";
    media.push(el);
  }

  const running: AnimationPlaybackControls[] = [];
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    for (const split of splits) split.restore();
    clear(touched);
    /* And once more, a frame later. Motion writes each animation's final
       keyframe to the inline style and then takes it off again, and that can
       land after the clear above — which leaves the properties empty but the
       `style` attribute itself behind. Invisible on screen, and not invisible
       at all in `innerHTML`, which is what the line reveal snapshots. */
    requestAnimationFrame(() => {
      for (const el of touched) {
        if (el.hasAttribute("style") && !el.style.length) el.removeAttribute("style");
      }
    });
  };

  const settle = () => requestAnimationFrame(finish);

  const play = () => {
    if (done) return;

    if (media.length) {
      const controls = animate(
        media,
        flat
          ? { opacity: [0, 1] }
          : { opacity: [0, 1], translate: [`0px ${RISE}px`, "0px 0px"] },
        { duration: PAGE_S, delay, ease: EASE }
      );
      running.push(controls);
    }

    for (const [index, split] of splits.entries()) {
      const base = delay + Math.min(index, STAGGER_CAP) * stagger;
      const controls = animate(
        split.lines,
        { translate: [`0px ${LINE.from}`, "0px 0em"] },
        {
          duration: LINE.duration,
          delay: (line: number) => base + line * LINE.lineStagger,
          ease: LINE.ease
        }
      );
      running.push(controls);
    }

    if (!running.length) {
      finish();
      return;
    }

    /* A frame after the finish, not on it. Motion commits each animation's
       final keyframe to the inline style on the frame after its promise
       resolves, so a clear that runs in the promise's own microtask is
       overwritten by the very values it was removing. */
    Promise.all(running.map((controls) => controls.finished)).then(settle, settle);
  };

  return {
    play,
    stop: () => {
      for (const controls of running) controls.stop();
      finish();
    }
  };
}

/* The identity, which rolls rather than fades.
 *
 * The left pane's heading is the one piece of type that is replaced rather than
 * arriving on an empty page: the old title and the new one want the same three
 * lines of the same pane. Cross-fading them there is the worst of the options —
 * for half a second both are legible in the same place at half strength, which
 * is not a transition but a smear.
 *
 * The reference sets its header in a box that clips, and turns it like an
 * odometer: the outgoing line leaves through one edge while the incoming one
 * arrives through the opposite one, both on the page curve and the page clock,
 * so what the eye follows is a single wheel rather than two texts arguing.
 *
 * Which edge is decided by the destination, not by the direction of travel, and
 * that is what makes it read as a place rather than a step. Home always lives
 * above: it enters from the top and leaves through the top. A project always
 * lives below. So going home to a project, the name rolls up and out while the
 * project title rolls up into its place — one upward turn, two labels. Coming
 * back turns the same wheel the other way. */
const ROLL = 160;

/* Both ends of the keyframe carry the same unit. Motion mixes a compound value
   like `translate` component by component, and a component that is `160%` at one
   end and a bare `0` at the other is two different types rather than two
   positions — it gives up quietly and the line simply sits at its start until
   the clock runs out. `0% 0%` costs nothing and cannot be misread. */
const HOME = "0% 0%";

export type From = "above" | "below";

export interface RollOptions {
  from: From;
  /* Leaving rather than arriving: the same distance, travelled the other way. */
  out?: boolean;
  delay?: number;
}

export function rollIdentity(
  container: HTMLElement | null,
  { from, out = false, delay = 0 }: RollOptions
): Reveal {
  const lines = container
    ? Array.from(container.querySelectorAll<HTMLElement>(".identity__roll"))
    : [];

  if (!lines.length || reduced()) {
    const done = () => clear(lines);
    return { play: done, stop: done };
  }

  const off = `0% ${from === "above" ? -ROLL : ROLL}%`;
  let controls: AnimationPlaybackControls | null = null;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    /* An outgoing line is cleared too, even though it is about to be thrown
       away with the copy it belongs to: a cancelled navigation leaves that copy
       in the document, and a line parked at 160% is a line nobody can read. */
    clear(lines);
  };

  if (!out) {
    for (const line of lines) {
      line.style.translate = off;
      line.style.willChange = "translate";
    }
  }

  return {
    play: () => {
      if (done) return;
      controls = animate(
        lines,
        { translate: out ? [HOME, off] : [off, HOME] },
        { duration: PAGE_S, delay, ease: EASE }
      );
      const settle = () => requestAnimationFrame(finish);
      controls.finished.then(settle, settle);
    },
    stop: () => {
      controls?.stop();
      finish();
    }
  };
}

export function playEnter(home: boolean): (() => void) | undefined {
  const identity = rollIdentity(document.querySelector(".identity:not(.is-ghost)"), {
    from: home ? "above" : "below"
  });
  const elements = pieces();
  const arrival = reveal(elements, { delay: 0, flat: hasPendingHero() });
  identity.play();
  arrival.play();
  return () => {
    identity.stop();
    arrival.stop();
  };
}

/* Navigation that does not wait.
 *
 * Returns a `go` to call in place of letting a <Link> do its own thing. The
 * href stays on the anchor, so middle-click, ctrl-click and "open in new tab"
 * all keep working — this only takes over the plain left click.
 *
 * `warmSrc` is the image the destination is about to be flown to, and it is the
 * one thing still allowed to hold the navigation up. Landing a flight on an
 * image that has not decoded is the single blink the flight cannot hide, so it
 * is waited on — but `warm` caps itself, a cached hero resolves in the same
 * tick, and the cap is a fraction of what the old exit cost. */
export function useTransitionNavigate() {
  const navigate = useNavigate();
  const leaving = useRef(false);

  return useCallback(
    (to: string, before?: () => void, warmSrc?: string) => {
      // A second click while the first is still in flight would capture a
      // second flyer over the first; the page is already on its way.
      if (leaving.current) return;
      leaving.current = true;
      before?.();
      warm(warmSrc).then(() => {
        leaving.current = false;
        navigate(to);
      });
    },
    [navigate]
  );
}

/* Before the paint, not after.
 *
 * The arrival holds every piece at its start state, and type is held by being
 * split into masked lines — DOM surgery, on markup React has just committed. A
 * passive effect runs after the browser has painted, so there would be exactly
 * one frame of the new page at full opacity with its paragraphs unmasked before
 * any of that took hold. One frame is enough to see.
 *
 * Prerendering renders these components on the server, where a layout effect is
 * both meaningless and noisy; the first render is skipped there anyway. */
const useArrival = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* Plays the arriving page in. Skips the very first render: nothing left, so
   there is nothing for this to be the other half of — that one is the opening,
   and useBootReveal owns it. */
export function usePageEnter() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useArrival(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    return playEnter(pathname === "/");
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
