import { useEffect, type RefObject } from "react";
import { animate } from "motion";
import { EASE_CSS, GLIDE, PAGE_MS, PAGE_S } from "../lib/motion";

/* The card that flies between the home deck and a project page.
 *
 * This used to be the hard part. The two ends of the flight lived in different
 * documents, so the source geometry had to be written to sessionStorage, read
 * back by whatever loaded next, and matched against a destination that might
 * not have finished downloading. None of that is true any more: both elements
 * are in the same document, a module-level variable carries the rectangle
 * across, and the flight is an ordinary FLIP.
 *
 * The scale is uniform, always: a photo stretched between a near-square card
 * and a wide banner is the one thing that gives a morph away. The two boxes
 * rarely share an aspect ratio, and that difference is taken up by a clip
 * instead — at the start the flyer is masked to the source's shape, and the
 * mask opens as it travels. Nothing inside is distorted; the window onto it
 * widens.
 *
 * (The reference gets away with a plain shared-layout morph and no clip at all,
 * but only because its card and its project hero are the same rectangle at two
 * sizes — 33.5/34.4 at both ends. Ours are 0.96 and about 1.78. The clip is
 * doing real work here and is the one place this deliberately keeps its own
 * mechanism rather than copying theirs.)
 *
 * What changed when the navigation stopped waiting is that the flight no longer
 * has to fill time. It used to be built at click time and then hold still for
 * the length of an exit — a third of a second in which the page was visibly
 * leaving and the thing the reader had actually clicked did nothing at all —
 * and it covered that dead beat by swelling very slightly, an anticipation
 * before a throw. There is no dead beat now. The route mounts on the next
 * frame, so the flight starts on the next frame, and an anticipation with
 * nothing to anticipate is just a wobble. It is gone.
 */

/* The same clock as everything else a navigation moves: the outgoing page
   fading, the arriving one rising, and this. A morph that finishes before the
   page it is landing on reads as a separate event. */
const FLIGHT_MS = PAGE_MS;
const LAND_MS = 180;

/* A flyer whose navigation never happened would otherwise sit over the page
   forever. Long enough to cover a slow route, short enough that a cancelled
   click cleans itself up before it is noticed. */
const ORPHAN_MS = 2500;

export interface Shot {
  src: string;
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
  position: string;
  /* How far the page under the copy is about to slide back down as it rides to
     its own top (routes/layout.tsx). `top` is already the seat the source will
     be sitting in once that is over — which is the one the flight has to be
     measured from, because it is where the flight ends — and the copy is held
     this far above it to begin with and let down on the scroll's own curve. */
  lift: number;
}

interface Pending {
  shot: Shot;
  node: HTMLImageElement;
  /* The thing the flyer was copied from, hidden for as long as the copy is
     standing in for it. */
  source: HTMLElement | null;
  orphan: ReturnType<typeof setTimeout>;
}

let pending: Pending | null = null;

function capture(el: Element | null | undefined, lift: number): Shot | null {
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
    top: box.top + lift,
    left: box.left,
    width: box.width,
    height: box.height,
    radius: (parseFloat(style.borderTopLeftRadius) || 0) * drawn,
    position: style.objectPosition,
    lift
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

/* What to hide while the copy is out, and how.
 *
 * A tile's image fills its card exactly — same box, same radius — so hiding the
 * card rather than the picture leaves no empty rounded plate behind on the page
 * that is fading out. Everywhere else the element itself is the whole of what
 * was copied. This mattered little when the outgoing page left in a quarter of
 * a second; it lingers for the length of the flight now.
 *
 * It is a class and not an inline style because useDeck's painter also writes
 * `visibility` to .tile__card — it hides the cards past the far edge of the
 * wheel and clears the property on every card still on it, every frame. An
 * inline `hidden` written here survives until the next paint and no longer,
 * which is about ten milliseconds. A class the painter does not know about
 * survives because clearing the inline value is precisely what lets it apply.
 * (Two owners of one property, and the way out is to stop sharing it.) */
const HANDOFF = "is-handoff";

function coverFor(el: Element): HTMLElement {
  return (el.closest<HTMLElement>(".tile__card") ?? el) as HTMLElement;
}

/* True from the moment an arriving route claims the flight until that flight
   has landed or given up.

   `pending` cannot answer this on its own. The claim happens in the arriving
   route's effect, and React runs a child route's effects before its parent
   layout's — so by the time playEnter asks, the flight has already been taken
   and `pending` is null again. The question it is actually asking is not "is a
   flight waiting" but "is this a page a flight is arriving on", and only a flag
   that outlives the claim can answer that. Without it every arrival lifted its
   hero underneath the copy that was landing on it. */
let airborne = false;

export function hasPendingHero() {
  return pending !== null || airborne;
}

export function discardHero() {
  if (!pending) return;
  clearTimeout(pending.orphan);
  pending.node.remove();
  pending.source?.classList.remove(HANDOFF);
  pending = null;
}

/* Called on the click that starts a navigation, before React has torn anything
   down. Silently does nothing if there is no image to hand over.

   `lift` is how far the pane the source sits in is about to travel back to its
   own top; zero everywhere the page that is leaving was not scrolled. */
export function captureHero(el: Element | null | undefined, lift = 0) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  discardHero();
  const shot = capture(el, lift);
  if (!shot) return;

  /* Standing exactly where the source is, so the swap from real card to copy
     is not visible even though it happens on the click itself. The seat is the
     one the source is travelling towards, so being where it is now means being
     held a lift above it — on `translate`, which the flight then lets down
     without disturbing the `transform` that carries the morph. */
  const node = makeFlyer(shot);
  node.style.top = `${shot.top}px`;
  node.style.left = `${shot.left}px`;
  node.style.width = `${shot.width}px`;
  node.style.height = `${shot.height}px`;
  node.style.borderRadius = `${shot.radius}px`;
  if (lift) node.style.translate = `0px ${-lift}px`;
  document.body.appendChild(node);

  const source = coverFor(el!);
  source.classList.add(HANDOFF);

  pending = { shot, node, source, orphan: setTimeout(discardHero, ORPHAN_MS) };
}

function fly(shot: Shot, node: HTMLImageElement, target: HTMLElement) {
  const to = target.getBoundingClientRect();
  if (!to.width || !to.height) return null;

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

  /* The page underneath is riding back to its own top over the same second, and
     a copy that ignored that would pull away from the hole it came out of. The
     ride is a separate property from the morph — `translate` composes ahead of
     `transform` rather than replacing it — so the two can keep their own curves:
     the copy is let down on the scroll's, and carried to the card on the
     page's. Both land on the same frame, which is the only part that has to
     agree. */
  const ride = shot.lift
    ? animate(
        node,
        { translate: [`0px ${-shot.lift}px`, "0px 0px"] },
        { duration: PAGE_S, ease: GLIDE }
      )
    : null;

  return { node, animation, ride };
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
      const flight = fly(claimed.shot, claimed.node, target);
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
        flight.ride?.complete();
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
        flight.ride?.stop();
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
