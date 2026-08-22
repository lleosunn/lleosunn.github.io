/* Smooth scrolling for the right pane.

   The pane is its own scroll container, so Lenis is attached to it rather than
   to the window: it swallows wheel events and writes scrollTop itself on a
   1.2s expo-out glide instead of letting the browser step. Everything
   downstream — nav.js's wheel, the dots, the loop wrap — keeps reading
   scrollTop and never has to know a library is driving it.

   Touch is left alone. A finger already carries its own momentum and layering
   a second curve on top of it feels like drag, so syncTouch takes over the
   gesture only to keep it 1:1 (duration 0) and hand the fling back to the
   platform curve. */
(function () {
  var scroller = document.getElementById("scroller");
  if (!scroller || typeof Lenis === "undefined") return;

  // Reduced motion asks for the browser's own scrolling, untouched. nav.js
  // reads the same query and glues its wheel to scrollTop for the same reason.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var touch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  var lenis = new Lenis({
    wrapper: scroller,
    /* Only ever the ResizeObserver target: with an element wrapper Lenis
       measures wrapper.scrollHeight for its limit. Watching the child is what
       catches prose growing as its images arrive. */
    content: scroller.firstElementChild || scroller,
    orientation: "vertical",
    duration: touch ? 0 : 1.2,
    easing: touch
      ? function (t) {
          return 1 - Math.pow(1 - t, 3);
        }
      : function (t) {
          return Math.min(1, 1.001 - Math.pow(2, -10 * t));
        },
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1,
    syncTouch: touch,
    infinite: false
  });

  // nav.js writes scrollTop directly for the loop wrap and for dot clicks, and
  // an external write made mid-glide is ignored — Lenis would drag the pane
  // back to where it thought it was on the next frame. Both moves go through
  // here instead.
  window.__lenis = lenis;

  var frame = function (time) {
    lenis.raf(time);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Fonts and images settle after first paint and change how far the pane can
  // scroll; autoResize only sees box changes, not a late reflow inside one.
  window.addEventListener("load", function () {
    lenis.resize();
  });
})();
