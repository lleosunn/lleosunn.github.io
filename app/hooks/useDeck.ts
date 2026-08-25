import { useEffect, useRef, type RefObject } from "react";
import type Lenis from "lenis";

/* Home tile wheel: a looping ring of cards that recede toward the edges of the
   pane, the dots that track it, and the card whose geometry the hero flight
   takes off from.

   This is a port of nav.js and the geometry is unchanged. What changed is only
   who owns the DOM: React renders the slots, this hook measures and transforms
   them. Nothing here is React state — the per-frame values are written straight
   to style, because routing a transform through a render on every frame is the
   one thing that would make this worse than the file it replaces.

   Lenis owns the smoothing. This hook still owns where the scroll ends up once
   it stops: the loop wrap, which moves scrollTop by a whole list length in one
   assignment, and the snap, which draws the nearest card the rest of the way
   in. Both are moves Lenis has to be told about, or it drags the pane back on
   the next frame. */

const SHRINK = 0.25;
const RIM_FIRST = 0.38;
const HORIZON = 0.47;
const RIM_DECAY = 0.58;
/* A card's own surface stays opaque so its edge reads as a solid sheet; what
   fades is what is printed on it. Titles go first — stacked labels read as a
   list, not a wheel — but the covers hang on. */
const WASH = 0.45;
const LABEL_FADE = 1.4;
const FADE_FROM = 4;
const FADE_TO = 5.5;

/* Held to the same proportion of the pane's glide as the wheel itself, so the
   settle reads as the tail of one gesture rather than a second one starting. */
const SNAP_MIN = 0.26;
const SNAP_MAX = 0.52;

const INDEX_KEY = "home-index";

/* The returning flight lands on whichever card the wheel has left in focus, and
   only this hook can say which of the slots that is or where the loop has left
   it on screen. Mirrors what nav.js published as window.__wheel. */
let focusedGetter: (() => HTMLElement | null) | null = null;
export function focusedTileImage(): HTMLElement | null {
  return focusedGetter ? focusedGetter() : null;
}

export function readStoredIndex(count: number): number {
  try {
    const n = parseInt(sessionStorage.getItem(INDEX_KEY) ?? "", 10);
    return n >= 0 && n < count ? n : 0;
  } catch {
    return 0;
  }
}

export function storeIndex(index: number) {
  try {
    sessionStorage.setItem(INDEX_KEY, String(index));
  } catch {
    /* Private mode. The deck just starts at the first card next time. */
  }
}

export interface DeckOptions {
  scrollerRef: RefObject<HTMLElement | null>;
  lenisRef: RefObject<Lenis | null>;
  count: number;
  copies: number;
  /* The deck only exists on the home route. The hook is still called from the
     layout on every route — the dots it drives are the layout's, not the home
     route's — so the switch is a flag rather than a conditional call. */
  enabled: boolean;
  onActive: (index: number) => void;
}

export function useDeck({ scrollerRef, lenisRef, count, copies, enabled, onActive }: DeckOptions) {
  const activeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const scroller = scrollerRef.current;
    if (!scroller || !count) return;

    const slots = Array.from(scroller.querySelectorAll<HTMLElement>(".tile"));
    if (!slots.length) return;

    const cards = slots.map((s) => s.querySelector<HTMLElement>(".tile__card"));
    const images = slots.map((s) => s.querySelector<HTMLElement>(".tile__image"));
    const names = slots.map((s) => s.querySelector<HTMLElement>(".tile__name"));

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = () => lenisRef.current;

    let port = 0, slotH = 0, cardH = 0, brim = 0, lap = 0;
    let loLimit = 0, hiLimit = 0;
    let active = -1, activeSlot = 0;
    const parked: boolean[] = [];
    const centres: number[] = [];

    /* At 1 the wheel is glued to the scroller, which is the normal case: Lenis
       eases upstream and chasing an already-eased position only adds lag. The
       easing survives for the two cases where nothing upstream is smoothing —
       reduced motion, and Lenis failing to construct. */
    const EASE = reduceMotion || lenis() ? 1 : 0.25;
    let eased = 0, target = 0, raf = 0, lastFrame = 0;

    const measure = () => {
      port = scroller.clientHeight;
      slotH = slots[0].offsetHeight || port;
      cardH = cards[0] ? cards[0]!.offsetHeight : 0;
      brim = cardH / 2 / port;
      lap = count * slotH;
      // Read every slot's box once: render() interleaves style writes with
      // these reads, and measuring inside that loop forces a layout per card
      // per frame — the whole cost of the effect on a long list.
      for (let i = 0; i < slots.length; i++) {
        centres[i] = slots[i].offsetTop + slots[i].offsetHeight / 2;
      }
      loLimit = lap * 0.5;
      hiLimit = (slots.length - 1) * slotH - lap * 0.5;
    };

    const topFor = (i: number) => centres[i] - port / 2;

    const nearestSlot = () => {
      const here = scroller.scrollTop + port / 2;
      let best = 0, bestGap = Infinity;
      for (let i = 0; i < centres.length; i++) {
        const gap = Math.abs(centres[i] - here);
        if (gap < bestGap) { bestGap = gap; best = i; }
      }
      return best;
    };

    /* `turned` is how far the wheel has eased round and decides each card's
       seat; `here` is where the scroller actually is. A card's transform has to
       cancel `here`, not `turned`, or the leftover displaces every card at once
       and the barrel slides up the pane while it turns. */
    const render = () => {
      const turned = eased + port / 2;
      const here = target + port / 2;
      let nearest = 0, nearestDistance = Infinity;

      for (let i = 0; i < slots.length; i++) {
        const centre = centres[i];
        const tracking = Math.abs(centre - here);
        if (tracking < nearestDistance) { nearestDistance = tracking; nearest = i; }

        const offset = (centre - turned) / port;
        const slotAt = (centre - here) / port;
        const t = Math.abs(offset);

        const card = cards[i];
        if (!card || reduceMotion) continue;

        if (t > FADE_TO) {
          // Parked cards keep their layout position, already several
          // scrollports away. A transform left on them would extend the pane's
          // scrollable area for no visible gain.
          if (!parked[i]) {
            card.style.transform = "";
            card.style.opacity = "0";
            slots[i].style.zIndex = "0";
            parked[i] = true;
          }
          continue;
        }

        const scale = 1 / (1 + SHRINK * t);
        const half = (scale * cardH) / 2 / port;
        const rim =
          t <= 1
            ? brim + t * (RIM_FIRST - brim)
            : HORIZON - (HORIZON - RIM_FIRST) * Math.pow(RIM_DECAY, t - 1);
        const reach = rim - half;
        const shift = ((offset < 0 ? -reach : reach) - slotAt) * port;
        const fade = t <= FADE_FROM ? 1 : (FADE_TO - t) / (FADE_TO - FADE_FROM);

        card.style.transform = `translateY(${shift.toFixed(2)}px) scale(${scale.toFixed(4)})`;
        card.style.opacity = fade.toFixed(3);
        if (images[i]) images[i]!.style.opacity = Math.max(0, 1 - WASH * t).toFixed(3);
        if (names[i]) names[i]!.style.opacity = Math.max(0, 1 - LABEL_FADE * t).toFixed(3);
        // Nearer cards must paint over further ones; DOM order would put every
        // card below centre on top of the focused one.
        slots[i].style.zIndex = String(Math.max(0, 1000 - Math.round(t * 100)));
        parked[i] = false;
      }

      activeSlot = nearest;
      const index = parseInt(slots[nearest].dataset.index ?? "0", 10) || 0;
      if (index !== active) {
        active = index;
        activeRef.current = index;
        onActive(index);
      }
    };

    const frame = (now: number) => {
      const elapsed = lastFrame ? Math.min(now - lastFrame, 64) : 16.7;
      lastFrame = now;
      target = scroller.scrollTop;

      const gap = target - eased;
      // Sub-pixel remainders never reach zero on their own; left alone they
      // keep a frame loop alive behind a wheel that has visibly stopped.
      if (Math.abs(gap) < 0.5) {
        eased = target; raf = 0; lastFrame = 0;
        render();
        return;
      }
      eased += gap * (1 - Math.pow(1 - EASE, elapsed / 16.7));
      render();
      raf = requestAnimationFrame(frame);
    };

    const tick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    const settle = () => { target = scroller.scrollTop; eased = target; render(); };

    /* Lenis re-asserts its own idea of the position each frame, so a bare
       assignment made mid-glide is undone before it is seen. */
    const jump = (top: number) => {
      scroller.scrollTop = top;
      lenis()?.scrollTo(top, { immediate: true, force: true });
    };

    const wrap = () => {
      if (copies < 3) return;
      if (scroller.scrollTop < loLimit) {
        jump(scroller.scrollTop + lap);
        eased += lap;
      } else if (scroller.scrollTop > hiLimit) {
        jump(scroller.scrollTop - lap);
        eased -= lap;
      } else return;
      // Exactly one list length, so it lands at the same offset within an
      // identical run of cards. Carrying `eased` by the same lap keeps easing
      // still in flight pointed at the same card, so the wrap stays invisible.
      target = scroller.scrollTop;
      render();
    };

    let snapTo: number | null = null;

    const snap = () => {
      if (!port || !slotH || !centres.length) return;
      const top = topFor(nearestSlot());
      const gap = top - scroller.scrollTop;
      if (Math.abs(gap) < 1) { snapTo = null; return; }
      // wrap() re-asserts scrollTop through Lenis, which answers an instant
      // move with a scrollend of its own a frame later. Without this the snap
      // is torn down and restarted one frame after it began, every time a
      // scroll happens to settle across the seam.
      if (snapTo !== null && Math.abs(top - snapTo) < 1) return;
      snapTo = top;

      const l = lenis();
      if (l) {
        const reach = Math.min(1, Math.abs(gap) / (slotH / 2));
        l.scrollTo(top, {
          duration: SNAP_MIN + (SNAP_MAX - SNAP_MIN) * reach,
          force: true
        });
      } else {
        scroller.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
      }
      tick();
    };

    // A fresh gesture abandons whatever snap is in flight, leaving snapTo
    // naming a card the scroll has since moved off — the guard above would
    // then read that stale name as "already going there".
    const release = () => { snapTo = null; };
    const settled = () => { wrap(); snap(); };

    const onResize = () => {
      measure();
      // Lenis clamps every move to a limit it caches; re-centring against a
      // limit measured at the old viewport height would land short.
      lenis()?.resize();
      jump(topFor(activeSlot));
      settle();
    };
    const onLoad = () => { measure(); settle(); };
    const onPageHide = () => storeIndex(active);

    scroller.addEventListener("scroll", tick, { passive: true });
    scroller.addEventListener("wheel", release, { passive: true });
    scroller.addEventListener("touchstart", release, { passive: true });

    let idle: ReturnType<typeof setTimeout>;
    const onIdleScroll = () => { clearTimeout(idle); idle = setTimeout(settled, 160); };
    const hasScrollEnd = "onscrollend" in window;
    if (hasScrollEnd) scroller.addEventListener("scrollend", settled, { passive: true });
    else scroller.addEventListener("scroll", onIdleScroll, { passive: true });

    window.addEventListener("resize", onResize);
    window.addEventListener("load", onLoad);
    window.addEventListener("pagehide", onPageHide);

    measure();
    jump(topFor(count + readStoredIndex(count)));
    settle();

    focusedGetter = () => images[activeSlot] ?? null;

    return () => {
      storeIndex(active);
      focusedGetter = null;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(idle);
      scroller.removeEventListener("scroll", tick);
      scroller.removeEventListener("wheel", release);
      scroller.removeEventListener("touchstart", release);
      if (hasScrollEnd) scroller.removeEventListener("scrollend", settled);
      else scroller.removeEventListener("scroll", onIdleScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onLoad);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [scrollerRef, lenisRef, count, copies, enabled, onActive]);

  return {
    scrollToIndex: (index: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      // Always aim at the middle copy so the runway stays balanced.
      const slots = Array.from(scroller.querySelectorAll<HTMLElement>(".tile"));
      const slot = slots[count + index];
      if (!slot) return;
      const top = slot.offsetTop + slot.offsetHeight / 2 - scroller.clientHeight / 2;
      const l = lenisRef.current;
      // Handed to Lenis rather than assigned, so the wheel turns the whole way
      // round to the project instead of cutting to it.
      if (l) l.scrollTo(top, { force: true });
      else scroller.scrollTop = top;
    },
    activeRef
  };
}
