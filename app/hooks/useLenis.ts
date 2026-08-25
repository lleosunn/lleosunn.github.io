import { useEffect, useRef, type RefObject } from "react";
import Lenis from "lenis";

/* Smooth scrolling for the right pane.
 *
 * The pane is its own scroll container, so Lenis is attached to it rather than
 * to the window: it swallows wheel events and writes scrollTop itself on a 0.7s
 * expo-out glide instead of letting the browser step.
 *
 * The instance is created once, in the layout, and outlives every navigation.
 * That is the difference the rewrite bought: the old site tore this down and
 * rebuilt it on every click because the document itself went away.
 *
 * Touch is left alone. A finger already carries its own momentum and layering a
 * second curve on top of it feels like drag, so syncTouch takes over the gesture
 * only to keep it 1:1 (duration 0) and hands the fling back to the platform.
 */
export function useLenis(scrollerRef: RefObject<HTMLElement | null>) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // Reduced motion asks for the browser's own scrolling, untouched.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const touch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    const lenis = new Lenis({
      wrapper: scroller,
      /* The scroller itself: with an element wrapper Lenis measures
         wrapper.scrollHeight for its limit, and `content` is only ever the
         ResizeObserver target. The pane's own box never changes, so growth
         inside it is caught by the observer the layout attaches per route
         instead. */
      content: scroller,
      orientation: "vertical",
      /* The reference's number, and longer than it looks: a notch keeps moving
         for well over a second after the hand has stopped. That is what the
         glide is for. The instinct to shorten it — on the theory that the lag
         between wheel and movement is what reads as slow — is what put 0.7 here
         before, and 0.7 is not a compromise between two feels; it is a third
         one that matches nothing. */
      duration: touch ? 0 : 1.2,
      easing: touch
        ? (t: number) => 1 - Math.pow(1 - t, 3)
        : (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      /* One notch is one notch, both here and on the reference. Scaling it up
         was meant to make a long project page shorter to get down; what it
         actually did was make every page feel like it was being pulled out from
         under the reader, because the distance no longer matched the gesture.
         The duration above is what carries a notch further, not a multiplier —
         the same distance, given more time. */
      wheelMultiplier: 1,
      touchMultiplier: 1,
      syncTouch: touch,
      infinite: false
    });

    lenisRef.current = lenis;

    let id = requestAnimationFrame(function frame(time: number) {
      lenis.raf(time);
      id = requestAnimationFrame(frame);
    });

    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [scrollerRef]);

  return lenisRef;
}
