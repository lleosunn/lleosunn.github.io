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
 * On top of that sits a title card, which is Leo's and not the reference's: the
 * same head script sets data-load beside data-boot, and the panel prerendered
 * in root.tsx covers the whole of step 2 and 3 with a name and a filling rule
 * rather than with a held-back page. It is a second curtain in front of the
 * first, and the two overlap on the way out — the card resolves partway into
 * its own fade and the schedule starts there, so a second of waiting and a
 * second of opening are not spent one after the other. See CARD below.
 *
 * If the bundle never loads, the timer the head script armed takes both
 * attributes off by itself, and the page is merely a page.
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

/* The title card, and the only numbers on this site that were chosen rather
 * than lifted from the reference — it has no loading screen at all. Its shell
 * is an empty #root and its bundle holds no preloader; it simply stays blank
 * until its intro can play. This is Leo's addition on top of that, so what the
 * numbers are chosen against is the opening they hand over to. Same background,
 * same curve, same masked type: the question each one answers is when, not
 * what.
 *
 * The entrances are not here. They are CSS on :root[data-load], because they
 * have to start at the first paint and not at hydration. What the script owns
 * is the end — the rule closing once the site is genuinely ready, the name
 * turning out of its mask, and the handover.
 */
const CARD = {
  /* The shortest the card is ever up: long enough to read as a title, short
     enough that nobody is kept behind it. The rule's CSS fill is timed to land
     here too, so on a warm cache the two arrive together.

     Counted from the moment the card went on screen, which is neither
     navigation start nor this effect running — see shown() below. */
  floor: 1000,
  /* What is left of the rule after the fill parks, closed in one move. */
  close: 0.22,
  /* The name turning up and out of its own box, which is what the identity's
     lines do on a route change. Not a fade: this site does not fade type. */
  out: 0.28,
  /* How far into the panel's fade the opening starts.
     The overlap is the point — the page assembles behind a sheet that is
     already clearing, which is what keeps a second of waiting from becoming
     two and a half. The delay is only long enough that the card's copy of the
     name is visibly on its way out before the left pane's copy arrives. */
  handover: 0.18
} as const;

/* Out through the top of the mask. ROLL in usePageTransition.ts, and the same
   distance for the same reason; both ends carry the unit, because motion reads
   a compound value component by component and `-160%` against a bare `0` is two
   types rather than two positions. */
const ROLL_OUT = "0% -160%";

const after = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* How far along the rule is, as a number.
 *
 * `scale` is two components here and only the first of them is the progress —
 * the second is pinned at 1 because the line is one pixel tall and a line
 * scaled vertically is a line that goes grey. Motion will not animate the pair:
 * it treats `scale` as a single number, and handed a compound string it sets
 * the value once and stops, which is the rule sticking at whatever fraction it
 * had reached when the site turned out to be ready. So the tween below is a
 * plain number written through onUpdate, the way layout.tsx drives the pane
 * going home, and this is the only value it needs to start from. */
function fillOf(el: HTMLElement): number {
  const value = parseFloat(getComputedStyle(el).scale);
  return Number.isFinite(value) ? value : 1;
}

interface Card {
  /* Milliseconds the card has actually been on screen. */
  shown: () => number;
  /* Finishes the rule, sends the card away, and resolves at the moment the
     opening behind it should start — which is partway into the panel's fade,
     not after it. */
  close: () => Promise<void>;
  stop: () => void;
}

function card(): Card | null {
  const root = document.documentElement;
  /* Absent for the same three reasons data-boot is: reduced motion, no script
     at the first paint, or the head script's timer got here first. */
  if (!root.hasAttribute("data-load")) return null;

  const panel = document.querySelector<HTMLElement>(".curtain");
  const word = panel?.querySelector<HTMLElement>(".curtain__word") ?? null;
  const rule = panel?.querySelector<HTMLElement>(".curtain__rule") ?? null;
  if (!panel || !word || !rule) {
    root.removeAttribute("data-load");
    return null;
  }

  const running: ReturnType<typeof animate>[] = [];

  /* How long the card has been visible, which is not how long the document has
     existed. Both of the easy answers are wrong in the same direction: on a
     slow connection the stylesheet that paints the card arrives well after
     navigation start, so a floor measured from the top of the document has
     already expired by the time anyone has seen anything — and the card blinks
     for half a second on precisely the load it was there to cover.

     The rule's own CSS animation knows. It begins at the first paint, which is
     the first moment the card exists to be looked at, and its startTime is that
     moment on the document's timeline. Read it rather than guess at it. */
  const shown = () => {
    const [entrance] = rule.getAnimations();
    const started = Number(entrance?.startTime);
    const now = Number(document.timeline.currentTime);
    return Number.isFinite(started) && Number.isFinite(now) ? now - started : performance.now();
  };

  return {
    shown,
    close: () => {
      /* Picked up where the stylesheet actually got to, not where it was going
         to get to. The fill parks at 0.72 in the common case and this could
         simply say so — but it is a nine hundred millisecond move and the site
         can be ready in the middle of it, in which case the number to carry on
         from is whatever fraction is on screen right now. */
      const from = fillOf(rule);
      rule.style.animation = "none";
      rule.style.scale = `${from} 1`;

      const filled = animate(from, 1, {
        duration: CARD.close,
        ease: EASE,
        onUpdate: (x) => {
          rule.style.scale = `${x} 1`;
        }
      });
      running.push(filled);

      return filled.finished.then(() => {
        /* The panel's own exit is the attribute coming off: it leaves on the
           stylesheet's transition so that this path and the head script's
           safety timer produce the same fade. Nothing here animates it. */
        root.removeAttribute("data-load");

        /* Its entrance finished half a second ago, so there is no in-flight
           value to seize — only a stylesheet rule to get out of the way of. */
        word.style.animation = "none";

        running.push(
          animate(word, { translate: ["0% 0%", ROLL_OUT] }, { duration: CARD.out, ease: EASE }),
          animate(rule, { opacity: [1, 0] }, { duration: CARD.out, ease: EASE })
        );

        return after(CARD.handover * 1000);
      });
    },
    stop: () => {
      for (const controls of running) controls.stop();
      root.removeAttribute("data-load");
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

    /* Null when there is no card to run — reduced motion, or the head script's
       timer having already taken it off — in which case everything below is the
       opening exactly as it was before the card existed. */
    const title = card();

    const groups: [string, number, boolean][] = [
      [WORK, SCHEDULE.work, false],
      /* The chrome fades where everything else rises. It is pinned to the
         edges of the pane — the icon row to the bottom, the dots to the side —
         and a piece that arrives from 160px below its own anchor reads as
         having been dropped rather than as having been there all along. */
      [CHROME, SCHEDULE.chrome, true]
    ];

    const all = () => groups.flatMap(([selector]) => pieces(selector));

    const open = () => {
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
    };

    /* Two waits, whichever is longer. The site being ready is the one that
       matters and the floor is the one that makes it look deliberate: without
       it a warm cache flashes the card for eighty milliseconds, which reads as
       a glitch rather than as an opening. Both are bounded — settled() gives up
       at BOOT_CAP, so the longest anyone can be held here is that. */
    const ready = Promise.all([
      settled(),
      title ? after(Math.max(0, CARD.floor - title.shown())) : Promise.resolve()
    ]);

    ready.then(() => {
      if (cancelled) return;

      if (reduced()) {
        root.removeAttribute("data-boot");
        title?.stop();
        return;
      }

      if (!title) {
        open();
        return;
      }

      /* The card resolves partway into its own fade, not at the end of it, so
         the page is already assembling behind a sheet that is on its way out.
         The rejection arm is the unmount case: stop() cancels the animation the
         promise belongs to, and there is nothing left to open onto. */
      title.close().then(() => {
        if (!cancelled) open();
      }, () => {});
    });

    return () => {
      cancelled = true;
      root.removeAttribute("data-boot");
      title?.stop();
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
