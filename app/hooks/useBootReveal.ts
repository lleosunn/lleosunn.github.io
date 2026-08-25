import { useEffect } from "react";
import { useLocation } from "react-router";
import { focusedTileImage } from "./useDeck";
import { heroPosterOf, previewOf, projects } from "../lib/projects";
import { ACTIVE_FROM_SCALE, ACTIVE_S, EASE } from "../lib/motion";
import { BOOT_CAP, preloadWhenIdle } from "../lib/preload";
import { clear, LIVE, pieces, reduced, reveal, rollIdentity, type Reveal } from "./usePageTransition";
import { animate } from "motion";

/* The opening.
 *
 * Every other move on this site is a transition between two states the reader
 * has already seen. This is the one with nothing behind it, and until recently
 * it was not a move at all. The site is prerendered, so the browser painted the
 * markup the instant it arrived — identity text at its final position, twelve
 * cards stacked on top of each other in the middle of the pane because the deck
 * had not run yet — and then hydration seated the wheel in a single frame. Two
 * pops, inside the two hundred milliseconds a first impression is made of.
 *
 * The reference (gabrielbeaugonin.com) never shows raw markup. Content starts
 * hidden; the work of getting ready happens behind that; then the page is
 * played in on a schedule. The order of operations is the whole trick:
 *
 *   1. The head script sets data-boot before the first paint, and CSS hides the
 *      panes' contents on sight. It has to be an attribute set by an inline
 *      script — a class React adds after hydration is added after the paint it
 *      was supposed to prevent.
 *   2. Hydration runs. useDeck measures the pane and writes every card's seat.
 *      All of it lands behind the curtain, so the wheel assembling is not
 *      something anyone watches happen.
 *   3. Fonts settle and the first image decodes, raced against a cap so a slow
 *      connection delays the opening rather than withholding it.
 *   4. Every piece is put at its start state, the curtain comes off, and the
 *      schedule below runs.
 *
 * If the bundle never loads, the timer the head script armed takes data-boot
 * off by itself, and the page is merely a page.
 */

/* The reference's schedule, in seconds from the moment the curtain lifts. Its
   own is in milliseconds and has two more beats than this site has things to
   put in them (a call to action, a minimap); what transfers is the shape.
   Nothing is evenly spaced. The name arrives almost immediately, the work a
   third of a second later, the one card the reader is actually looking at a
   beat after the stack it came out of, and the chrome last and alone — by which
   point the page has been readable for the better part of a second and the icon
   row appearing is a detail rather than an event. */
const SCHEDULE = {
  identity: 0.08,
  work: 0.36,
  active: 0.5,
  chrome: 1.26
};

/* Read in this order rather than document order, so the opening builds from
   what the reader came for outwards: the name, then the work, then the chrome
   around it. querySelectorAll would return the icon row before the deck. */
const WORK = [`${LIVE} .project__media`, `${LIVE} .prose > *`, `${LIVE} .tiles`].join(", ");
const CHROME = ".icon-row, .dots";

declare global {
  interface Window {
    __boot?: number;
  }
}

/* Fonts and the one image that is actually on screen. Anything past this is the
   idle prefetch's job, not the opening's. */
function settled(): Promise<unknown> {
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  const first = document.querySelector<HTMLImageElement>(
    ".project__media img, .tile:first-child .tile__image"
  );

  const image =
    !first || first.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const done = () => resolve();
          first.addEventListener("load", done, { once: true });
          first.addEventListener("error", done, { once: true });
        });

  return Promise.race([
    Promise.all([fonts, image]),
    new Promise((resolve) => setTimeout(resolve, BOOT_CAP))
  ]);
}

/* The focused card settling out of the stack.
 *
 * The reference's cards arrive edge-on and the front one turns to face the
 * reader; this deck is flat, so the half of that which survives the translation
 * is the scale — the card the reader will be looking at grows into place a beat
 * after the stack that delivered it, and a beat longer than the stack took.
 *
 * Written to `scale` on the .tile rather than to the .tile__card, because
 * useDeck owns that element's `transform` and rewrites it every frame. */
function settleFocused(): { hold: () => void; play: () => void; stop: () => void } | null {
  const tile = focusedTileImage()?.closest<HTMLElement>(".tile");
  if (!tile) return null;
  let controls: ReturnType<typeof animate> | null = null;
  const done = () => {
    tile.style.scale = "";
    tile.style.willChange = "";
  };
  return {
    hold: () => {
      tile.style.scale = String(ACTIVE_FROM_SCALE);
      tile.style.willChange = "scale";
    },
    play: () => {
      controls = animate(
        tile,
        { scale: [ACTIVE_FROM_SCALE, 1] },
        { duration: ACTIVE_S, delay: SCHEDULE.active, ease: EASE }
      );
      const settle = () => requestAnimationFrame(done);
      controls.finished.then(settle, settle);
    },
    stop: () => {
      controls?.stop();
      done();
    }
  };
}

export function useBootReveal() {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    /* Absent means there is nothing to reveal: reduced motion, no script at
       first paint, or the safety timer got here first. */
    if (!root.hasAttribute("data-boot")) return;

    window.clearTimeout(window.__boot);

    let cancelled = false;
    let reveals: Reveal[] = [];
    let heading: Reveal | null = null;
    let focused: ReturnType<typeof settleFocused> = null;

    const groups: [string, number, boolean][] = [
      [WORK, SCHEDULE.work, false],
      /* The chrome fades where everything else rises. It is pinned to the
         edges of the pane — the icon row to the bottom, the dots to the side —
         and a piece that arrives from 160px below its own anchor reads as
         having been dropped rather than as having been there all along. */
      [CHROME, SCHEDULE.chrome, true]
    ];

    const all = () => groups.flatMap(([selector]) => pieces(selector));

    settled().then(() => {
      if (cancelled) return;

      if (reduced()) {
        root.removeAttribute("data-boot");
        return;
      }

      /* Held before the curtain comes off, not after. Between removing the
         attribute and the first frame of the animations there is a paint, and a
         paint with the CSS gone but nothing yet holding the pieces back is the
         flash this whole hook exists to avoid. */
      reveals = groups
        .map(([selector, delay, flat]) => [pieces(selector), delay, flat] as const)
        .filter(([elements]) => elements.length)
        .map(([elements, delay, flat]) => reveal(elements, { delay, flat }));

      /* The heading turns up out of its own box rather than rising with the
         rest. On a route change the direction of that turn says which way the
         site has moved; there is no previous page to have moved from here, so
         it comes up from below like everything else in the opening does. */
      heading = rollIdentity(document.querySelector(".identity:not(.is-ghost)"), {
        from: "below",
        delay: SCHEDULE.identity
      });

      focused = settleFocused();
      focused?.hold();

      root.removeAttribute("data-boot");

      heading.play();
      for (const played of reveals) played.play();
      focused?.play();
    });

    return () => {
      cancelled = true;
      root.removeAttribute("data-boot");
      heading?.stop();
      focused?.stop();
      if (reveals.length) {
        for (const played of reveals) played.stop();
      } else {
        clear(all());
      }
    };
    /* Once per document. The route in the dependency list is only there so a
       cold load of a project page reveals that page's pieces rather than the
       home deck's; the guard above makes every later run a no-op. */
  }, [pathname]);

  /* The reference warms every thumbnail on requestIdleCallback once it is up.
     Here that is both previews and hero posters: the previews are what the
     wheel scrolls through, the posters are what a flight lands on, and neither
     should be arriving while it is being looked at. */
  useEffect(() => {
    preloadWhenIdle([
      ...projects.map((p) => previewOf(p)?.path),
      ...projects.map((p) => heroPosterOf(p))
    ]);
  }, []);
}
