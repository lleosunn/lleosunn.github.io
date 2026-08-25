import { useEffect } from "react";
import { useLocation } from "react-router";
import { heroPosterOf, previewOf, projects } from "../lib/projects";
import { preloadWhenIdle, WARM_CAP } from "../lib/preload";
import { clear, pieces, reduced, RISE, rise } from "./usePageTransition";

/* The opening.
 *
 * Every other move on this site is a transition between two states the reader
 * has already seen. This is the one with nothing behind it, and until now it
 * was not a move at all. The site is prerendered, so the browser painted the
 * markup the instant it arrived — identity text at its final position, twelve
 * cards stacked on top of each other in the middle of the pane because the deck
 * had not run yet — and then hydration seated the wheel in a single frame. Two
 * pops, inside the two hundred milliseconds a first impression is made of.
 *
 * The reference (gabrielbeaugonin.com) never shows raw markup. Content starts
 * hidden; the work of getting ready happens behind that; then one long,
 * unhurried rise plays it in. That is what this is. The order of operations is
 * the whole trick:
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
 *   4. The curtain comes off and the pieces rise, on the same curve and beat as
 *      every navigation that will follow.
 *
 * If the bundle never loads, the timer the head script armed takes data-boot
 * off by itself, and the page is merely a page.
 */

const BOOT_STAGGER = 0.08;

/* Read in this order rather than document order, so the opening builds from
   what the reader came for outwards: the name, then the work, then the chrome
   around it. querySelectorAll would return the icon row before the deck. */
const BOOT_ORDER = [".identity > *", ".project__media", ".prose > *", ".tiles", ".icon-row", ".dots"];

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
    new Promise((resolve) => setTimeout(resolve, WARM_CAP))
  ]);
}

function bootPieces(): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const ordered: HTMLElement[] = [];
  for (const selector of BOOT_ORDER) {
    for (const el of pieces(selector)) {
      if (seen.has(el)) continue;
      seen.add(el);
      ordered.push(el);
    }
  }
  return ordered;
}

export function useBootReveal() {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    /* Absent means there is nothing to reveal: reduced motion, no script at
       first paint, or the safety timer got here first. */
    if (!root.hasAttribute("data-boot")) return;

    window.clearTimeout(window.__boot);

    let stop: (() => void) | undefined;
    let cancelled = false;

    const elements = bootPieces();

    settled().then(() => {
      if (cancelled) return;

      if (reduced() || !elements.length) {
        root.removeAttribute("data-boot");
        return;
      }

      /* Written before the curtain comes off, not after. Between removing the
         attribute and motion's first frame there is a paint, and a paint with
         the CSS gone but the animation not yet started is the flash this whole
         hook exists to avoid. */
      for (const el of elements) {
        el.style.opacity = "0";
        el.style.translate = `0px ${RISE}px`;
        el.style.willChange = "translate, opacity";
      }
      root.removeAttribute("data-boot");

      stop = rise(elements, { stagger: BOOT_STAGGER });
    });

    return () => {
      cancelled = true;
      root.removeAttribute("data-boot");
      stop ? stop() : clear(elements);
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
