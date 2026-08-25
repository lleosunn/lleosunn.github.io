import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useVirtualDeck, wrapOffset } from "./useVirtualDeck";

/* Home tile wheel: a looping ring of cards that recede toward the edges of the
   pane, the dots that track it, and the card whose geometry the hero flight
   takes off from.

   The geometry below is unchanged — the constants, the rim curve, the wash and
   the fade are all the numbers the deck has always used, and the wheel looks
   exactly as it did. What changed is where the input comes from. It used to be
   `scroller.scrollTop`, smoothed by Lenis, with the loop faked by jumping
   scrollTop a whole list length and the centring done by a snap that fired
   after `scrollend`. Now it is a float in slot units owned by useVirtualDeck,
   and both of those disappear: a float has no seam to hide, so the three DOM
   copies are gone, and the detent is part of the spring rather than a second
   animation waiting for the first to stop.

   Nothing here is React state. The per-frame values are written straight to
   style, because routing a transform through a render on every frame is the one
   thing that would make this worse than the file it replaces. */

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

const INDEX_KEY = "home-index";

/* The returning flight lands on whichever card the wheel has left in focus, and
   only this hook can say which of the tiles that is. */
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
  count: number;
  /* The deck only exists on the home route. The hook is still called from the
     layout on every route — the dots it drives are the layout's, not the home
     route's — so the switch is a flag rather than a conditional call. */
  enabled: boolean;
  onActive: (index: number) => void;
}

export function useDeck({ scrollerRef, count, enabled, onActive }: DeckOptions) {
  const activeIndexRef = useRef(0);
  /* Measured once per resize and read every frame. Kept on a ref so the
     position callback below never has to close over changing values. */
  const metricsRef = useRef({ port: 0, cardH: 0, brim: 0 });
  const elementsRef = useRef<{
    cards: (HTMLElement | null)[];
    images: (HTMLElement | null)[];
    names: (HTMLElement | null)[];
    tiles: HTMLElement[];
  }>({ cards: [], images: [], names: [], tiles: [] });

  const reduceMotionRef = useRef(false);

  /* Writes one frame of the wheel. Called by useVirtualDeck every time the
     spring moves, and once directly on mount and resize. */
  const paint = useCallback(
    (pos: number) => {
      const { port, cardH, brim } = metricsRef.current;
      const { cards, images, names, tiles } = elementsRef.current;
      if (!port || !cards.length) return;
      if (reduceMotionRef.current) return;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card) continue;

        /* The only line that differs from the scroll-driven version: an offset
           that wraps is what makes the ring endless without a second copy of
           the list to cross into. */
        const offset = wrapOffset(i - pos, count);
        const t = Math.abs(offset);

        if (t > FADE_TO) {
          card.style.opacity = "0";
          card.style.visibility = "hidden";
          tiles[i].style.zIndex = "0";
          continue;
        }

        const scale = 1 / (1 + SHRINK * t);
        const half = (scale * cardH) / 2 / port;
        const rim =
          t <= 1
            ? brim + t * (RIM_FIRST - brim)
            : HORIZON - (HORIZON - RIM_FIRST) * Math.pow(RIM_DECAY, t - 1);
        const reach = rim - half;
        // Every tile is centred in the pane now, so the seat is the whole
        // displacement — there is no leftover slot position to cancel.
        const shift = (offset < 0 ? -reach : reach) * port;
        const fade = t <= FADE_FROM ? 1 : (FADE_TO - t) / (FADE_TO - FADE_FROM);

        card.style.visibility = "";
        card.style.transform = `translateY(${shift.toFixed(2)}px) scale(${scale.toFixed(4)})`;
        card.style.opacity = fade.toFixed(3);
        if (images[i]) images[i]!.style.opacity = Math.max(0, 1 - WASH * t).toFixed(3);
        if (names[i]) names[i]!.style.opacity = Math.max(0, 1 - LABEL_FADE * t).toFixed(3);
        // Nearer cards must paint over further ones; DOM order would put every
        // card below centre on top of the focused one.
        tiles[i].style.zIndex = String(Math.max(0, 1000 - Math.round(t * 100)));
      }
    },
    [count]
  );

  const handleActive = useCallback(
    (index: number) => {
      activeIndexRef.current = index;
      onActive(index);
    },
    [onActive]
  );

  const { goToIndex, positionRef, activeRef } = useVirtualDeck({
    scrollerRef,
    count,
    enabled,
    onPosition: paint,
    onActive: handleActive,
    initialIndex: typeof window === "undefined" ? 0 : readStoredIndex(count)
  });

  useEffect(() => {
    if (!enabled) return;
    const scroller = scrollerRef.current;
    if (!scroller || !count) return;

    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tiles = Array.from(scroller.querySelectorAll<HTMLElement>(".tile"));
    if (!tiles.length) return;

    elementsRef.current = {
      tiles,
      cards: tiles.map((t) => t.querySelector<HTMLElement>(".tile__card")),
      images: tiles.map((t) => t.querySelector<HTMLElement>(".tile__image")),
      names: tiles.map((t) => t.querySelector<HTMLElement>(".tile__name"))
    };

    const measure = () => {
      const card = elementsRef.current.cards[0];
      const port = scroller.clientHeight;
      const cardH = card ? card.offsetHeight : 0;
      metricsRef.current = { port, cardH, brim: port ? cardH / 2 / port : 0 };
      paint(positionRef.current);
    };

    measure();

    /* The card is sized in container units against the pane, so anything that
       changes the pane's box changes the geometry the wheel is drawn from. */
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);

    const onLoad = () => measure();
    const onPageHide = () => storeIndex(activeIndexRef.current);
    window.addEventListener("load", onLoad);
    window.addEventListener("pagehide", onPageHide);

    focusedGetter = () => elementsRef.current.images[activeIndexRef.current] ?? null;

    return () => {
      storeIndex(activeIndexRef.current);
      focusedGetter = null;
      observer.disconnect();
      window.removeEventListener("load", onLoad);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [scrollerRef, count, enabled, paint, positionRef]);

  return {
    scrollToIndex: (index: number) => goToIndex(index),
    activeRef
  };
}
