import { useEffect, type RefObject } from "react";
import { EASE_CSS, REVEAL_MS } from "../lib/motion";

/* The card that flies between the home deck and a project page.
 *
 * This used to be the hard part. The two ends of the flight lived in different
 * documents, so the source geometry had to be written to sessionStorage, read
 * back by whatever loaded next, and matched against a destination that might
 * not have finished downloading. None of that is true any more: both elements
 * are in the same document, a module-level variable carries the rectangle
 * across, and the flight is an ordinary FLIP.
 *
 * What changed with the transition rewrite is *when* the travelling copy is
 * made. It used to be built on arrival, which was fine while a click navigated
 * instantly — but the page now spends a couple of hundred milliseconds leaving
 * first, and during that time the card the user clicked was still an ordinary
 * child of .shell, fading out with everything else. So the copy is lifted at
 * click time instead. It is pinned to the viewport outside .shell, which is
 * what lets the whole page clear out from under it while it holds perfectly
 * still — the subject of the navigation never blinks.
 *
 * The scale is uniform, always: a photo stretched between a near-square card
 * and a wide banner is the one thing that gives a morph away. The two boxes
 * rarely share an aspect ratio, and that difference is taken up by a clip
 * instead — at the start the flyer is masked to the source's shape, and the
 * mask opens as it travels. Nothing inside is distorted; the window onto it
 * widens. */

/* The flight is the same move as the opening and every arrival — same curve,
   same clock — because it is the same hand. It used to run 600ms on easeOutCirc
   while everything around it ran 720ms on the site's curve, and a morph that
   leaves faster than the page it is leaving reads as a separate event. */
const FLIGHT_MS = REVEAL_MS;
const LAND_MS = 180;

/* The lift.
 *
 * The copy is made on the click and then stands perfectly still for the length
 * of the exit — a third of a second in which the page is visibly leaving and
 * the thing the reader actually clicked does nothing at all. It is the one dead
 * beat left in a navigation, and it is dead precisely because the flight cannot
 * start: there is no destination to fly to until the route it belongs to has
 * mounted.
 *
 * So the card starts moving without one. It swells very slightly, on the site's
 * curve, from the instant it is clicked — the anticipation before a throw. By
 * the time the destination exists the card is already in motion, and the flight
 * takes over from wherever the lift has got to rather than from a standstill.
 *
 * Written to `scale`, the standalone property, so it composes with the
 * `transform` the flight itself owns instead of fighting it. `transform-origin`
 * is the top-left corner (the flight needs it there), so the lift carries a
 * matching `translate` to keep the card growing about its own centre — without
 * it the card would slide down and right as it swells. Both unwind to nothing
 * over the flight, which is what makes the landing exact. */
const LIFT = 1.04;

/* Long enough to cover the exit and the render after it, so the swell is still
   in progress when the flight claims it. Overshooting is harmless: the unwind
   starts from wherever the lift actually is. */
const LIFT_MS = 380;

/* A flyer whose navigation never happened would otherwise sit over the page
   forever. Long enough to cover an exit plus a slow route, short enough that a
   cancelled click cleans itself up before it is noticed. */
const ORPHAN_MS = 2500;

export interface Shot {
  src: string;
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
  position: string;
}

interface Pending {
  shot: Shot;
  node: HTMLImageElement;
  lift: Animation | null;
  orphan: ReturnType<typeof setTimeout>;
}

let pending: Pending | null = null;

function capture(el: Element | null | undefined): Shot | null {
  if (!el) return null;
  const box = el.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  const style = getComputedStyle(el);
  const media = el as HTMLImageElement & HTMLVideoElement;
  const src = el.tagName === "VIDEO" ? media.poster : media.currentSrc || media.src;
  if (!src) return null;
  /* Every card but the focused one is scaled down by the deck, and a scaled
     corner is not the corner its stylesheet declares. getBoundingClientRect
     already composes the transform, so the radius has to be put on the same
     footing or a card clicked from the rim takes off rounder than it looked. */
  const drawn = (el as HTMLElement).offsetWidth
    ? box.width / (el as HTMLElement).offsetWidth
    : 1;
  return {
    src,
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
    radius: (parseFloat(style.borderTopLeftRadius) || 0) * drawn,
    position: style.objectPosition
  };
}

function makeFlyer(shot: Shot) {
  const img = document.createElement("img");
  img.className = "hero-fly";
  img.src = shot.src;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  // The source was on screen a moment ago, so it is in cache; decoding on the
  // spot avoids handing over a frame of empty box.
  img.decoding = "sync";
  img.style.objectPosition = shot.position;
  return img;
}

/* True from the moment an arriving route claims the flight until that flight
   has landed or given up.

   `pending` cannot answer this on its own. The claim happens in the arriving
   route's effect, and React runs a child route's effects before its parent
   layout's — so by the time usePageEnter asks, the flight has already been
   taken and `pending` is null again. The question it is actually asking is not
   "is a flight waiting" but "is this a page a flight is arriving on", and only
   a flag that outlives the claim can answer that. Without it every arrival
   lifted its hero 28px underneath the copy that was landing on it. */
let airborne = false;

export function hasPendingHero() {
  return pending !== null || airborne;
}

export function discardHero() {
  if (!pending) return;
  clearTimeout(pending.orphan);
  pending.node.remove();
  pending = null;
}

/* Called on the click that starts a navigation, before React has torn anything
   down. Silently does nothing if there is no image to hand over. */
export function captureHero(el: Element | null | undefined) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  discardHero();
  const shot = capture(el);
  if (!shot) return;

  /* Standing exactly where the source is, so the swap from real card to copy
     is not visible even though it happens on the click itself. */
  const node = makeFlyer(shot);
  node.style.top = `${shot.top}px`;
  node.style.left = `${shot.left}px`;
  node.style.width = `${shot.width}px`;
  node.style.height = `${shot.height}px`;
  node.style.borderRadius = `${shot.radius}px`;
  document.body.appendChild(node);

  pending = { shot, node, lift: swell(node, shot), orphan: setTimeout(discardHero, ORPHAN_MS) };
}

/* The anticipation, started on the click. See LIFT above for why it is written
   to `scale` and why it drags a `translate` along with it. */
function swell(node: HTMLImageElement, shot: Shot): Animation | null {
  if (typeof node.animate !== "function") return null;
  const back = (LIFT - 1) / 2;
  return node.animate(
    [
      { scale: "1", translate: "0px 0px" },
      {
        scale: String(LIFT),
        translate: `${(-back * shot.width).toFixed(2)}px ${(-back * shot.height).toFixed(2)}px`
      }
    ],
    { duration: LIFT_MS, easing: EASE_CSS, fill: "forwards" }
  );
}

function fly(shot: Shot, node: HTMLImageElement, lift: Animation | null, target: HTMLElement) {
  const to = target.getBoundingClientRect();
  if (!to.width || !to.height) return null;

  /* Read before the lift is cancelled — cancelling it puts these back to their
     unanimated values, and the whole point is to leave from where the card
     actually is. `none` is what an untouched element reports. */
  const held = getComputedStyle(node);
  const fromScale = held.scale === "none" ? "1" : held.scale;
  const fromShift = held.translate === "none" ? "0px 0px" : held.translate;
  lift?.cancel();

  const scale = Math.max(shot.width / to.width, shot.height / to.height);
  const insetX = (to.width - shot.width / scale) / 2;
  const insetY = (to.height - shot.height / scale) / 2;
  const dx = shot.left - to.left - scale * insetX;
  const dy = shot.top - to.top - scale * insetY;
  const endRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;

  /* Re-seated onto the destination's box. The transform in the first keyframe
     puts it back exactly where it is standing now, so this costs no visible
     frame — and the corner moves from border-radius to the clip, which is what
     carries it for the rest of the trip. */
  node.style.top = `${to.top}px`;
  node.style.left = `${to.left}px`;
  node.style.width = `${to.width}px`;
  node.style.height = `${to.height}px`;
  node.style.borderRadius = "";

  const animation = node.animate(
    [
      {
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        clipPath: `inset(${insetY}px ${insetX}px ${insetY}px ${insetX}px round ${shot.radius / scale}px)`
      },
      { transform: "none", clipPath: `inset(0px 0px 0px 0px round ${endRadius}px)` }
    ],
    { duration: FLIGHT_MS, easing: EASE_CSS, fill: "both" }
  );

  /* The lift, given back over exactly the length of the flight. The two run on
     one curve against the same clock, so what the eye sees is a single motion
     that happens to have begun before its destination existed. Ending at
     identity is not decoration: the flight's own last keyframe is `transform:
     none`, which only lands on the destination if nothing else is still
     scaling the node. */
  const unwind = node.animate(
    [
      { scale: fromScale, translate: fromShift },
      { scale: "1", translate: "0px 0px" }
    ],
    { duration: FLIGHT_MS, easing: EASE_CSS, fill: "both" }
  );

  return { node, animation, unwind };
}

/* Runs on the arriving page. `getTarget` is deferred because the element it
   names is rendered by the route that just mounted. */
export function useHeroLanding(getTarget: () => HTMLElement | null, key: string) {
  useEffect(() => {
    const claimed = pending;
    if (!claimed) return;
    clearTimeout(claimed.orphan);
    pending = null;
    airborne = true;

    let cancelled = false;
    let landed = false;
    let cleanup: (() => void) | null = null;

    /* A project's hero is `height: auto`, so its box is not a measurement until
       its file is there — zero for an image, and worse for a video, which falls
       back to the 150px every replaced element gets when nothing has told it
       otherwise. A card is the opposite: the card sizes it, so it measures on
       the first frame whether or not the picture has arrived. */
    const measurable = (target: HTMLElement) => {
      const box = target.getBoundingClientRect();
      if (!box.width || !box.height) return false;
      if (!target.closest(".project__media")) return true;
      return target.tagName === "VIDEO"
        ? (target as HTMLVideoElement).videoWidth > 0
        : (target as HTMLImageElement).complete &&
            (target as HTMLImageElement).naturalWidth > 0;
    };

    const land = (target: HTMLElement) => {
      const flight = fly(claimed.shot, claimed.node, claimed.lift, target);
      if (!flight) {
        airborne = false;
        return claimed.node.remove();
      }
      landed = true;

      // Hidden before the flyer is visible, so the destination is never briefly
      // showing underneath its own copy.
      target.style.visibility = "hidden";

      const reveal = () => {
        target.style.visibility = "";
        flight.node.remove();
        airborne = false;
      };

      /* A flight aims at where its destination is standing now. Scroll the pane
         and the destination walks out from under it, so the first sign of a
         hand on the wheel cuts the flight to its landing. */
      const interrupt = () => {
        flight.animation.finish();
        flight.unwind.finish();
      };
      window.addEventListener("wheel", interrupt, { once: true, passive: true });
      window.addEventListener("touchstart", interrupt, { once: true, passive: true });

      flight.animation.finished.then(() => {
        target.style.visibility = "";
        /* A card's preview and a project's hero are not always the same file —
           two of these projects deliberately differ. The landing is a swap
           either way, so it is crossed rather than cut. */
        flight.node
          .animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: LAND_MS,
            easing: "linear",
            fill: "forwards"
          })
          .finished.then(reveal, reveal);
      }, reveal);

      cleanup = () => {
        window.removeEventListener("wheel", interrupt);
        window.removeEventListener("touchstart", interrupt);
        flight.animation.cancel();
        flight.unwind.cancel();
        reveal();
      };
    };

    /* The wait is capped. Past a few hundred milliseconds the flight has missed
       its moment and a plain cut reads better than a late morph — but the copy
       has to go either way, or it is left standing over the page it failed to
       land on. */
    const deadline = performance.now() + 400;
    const attempt = () => {
      if (cancelled) return;
      const target = getTarget();
      if (target && measurable(target)) return land(target);
      if (performance.now() > deadline) {
        airborne = false;
        return claimed.node.remove();
      }
      requestAnimationFrame(attempt);
    };
    /* Deliberately not called synchronously. StrictMode runs this effect,
       tears it down, and runs it again — all before a frame is painted — so an
       attempt that could succeed on the spot would have its flight cancelled by
       that teardown and leave the second run with nothing to fly. A frame's
       delay puts every landing after the teardown, where the restore below can
       hand the flight to whichever run is the real one. */
    const first = requestAnimationFrame(attempt);

    return () => {
      cancelled = true;
      cancelAnimationFrame(first);
      if (landed) {
        cleanup?.();
        claimed.node.remove();
        return;
      }
      /* Never got off the ground, so this is either StrictMode's throwaway
         first pass or a route that unmounted before its hero arrived. Hand the
         copy back rather than destroying it: a re-run claims it and flies it,
         and if nothing ever does, the orphan timer clears it. */
      claimed.orphan = setTimeout(discardHero, ORPHAN_MS);
      pending = claimed;
      airborne = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/* Convenience for a route whose landing target is a ref. */
export function useHeroLandingRef(ref: RefObject<HTMLElement | null>, key: string) {
  useHeroLanding(() => ref.current, key);
}
