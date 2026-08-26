/* The site's one curve and its two clocks.
 *
 * Everything that moves here is the same move at a different scale: the page
 * opening, a route arriving, a card expanding into the project it belongs to.
 * They read as one hand only if they are literally the same numbers, so the
 * numbers live here rather than three times over — which is what let the flight
 * drift onto its own easing and its own clock without anyone noticing.
 *
 * These are the reference's (gabrielbeaugonin.com), lifted from its bundle. The
 * curve is worth reading in the two forms below: it leaves the mark gently
 * rather than snapping off it, covers most of the distance in the middle third,
 * and then spends a long time arriving. The slowness at the end is the whole
 * effect — a move that decelerates for over a second reads as heavy and
 * deliberate, where the same distance on a sharper curve reads as a flick.
 */

/* Its `easeOutTest`, which is the curve every large move on that site uses. */
export const EASE: [number, number, number, number] = [0.32, 0, 0, 1];

/* The same curve for the places that take a CSS string: WAAPI keyframes and
   the stylesheet's own transitions. */
export const EASE_CSS = "cubic-bezier(0.32, 0, 0, 1)";

/* Its `easeOutCubic`. The reference keeps a second, shorter curve for the two
   things that are not page-scale: a line of type sliding up behind its mask,
   and a block fading in as it is scrolled past. Both are small and frequent,
   and the page curve's long tail would make them feel late. */
export const EASE_OUT_CUBIC: [number, number, number, number] = [0.215, 0.61, 0.355, 1];

/* The wheel's curve, and the one large move on this site that is not EASE.
 *
 * Lenis's own expo-out. It leaves at full speed and spends the rest of the
 * second arriving, which is what a notch of a wheel feels like; the page curve,
 * which starts gently, is not — a scroll that eases in reads as the page being
 * dragged rather than thrown.
 *
 * It lives here rather than inside useLenis because a page on its way out rides
 * it too. The reference sends the page you are closing back to its own top with
 * an ordinary lenis.scrollTo, which is to say: the site's scrolling curve, on
 * the page clock — its `duration` there is Un, the same PAGE_S as the fade the
 * scroll is happening underneath. */
export const GLIDE = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

/* Its `Un` — the master duration. A navigation, a hero morph and a route
   arriving all run exactly this long, which is why they read as one event
   rather than three that happen to overlap. Seconds for motion's API,
   milliseconds for WAAPI's. */
export const PAGE_S = 1.2;
export const PAGE_MS = 1200;

/* Its intro `stackDuration`: what the opening's pieces take to arrive. Shorter
   than PAGE_S because the opening plays several of them in sequence and the
   sequence, not the individual piece, is what should last. */
export const REVEAL_S = 0.72;
export const REVEAL_MS = 720;

/* Its intro `activeDuration`: the focused card settling out of the stack, a
   beat longer than the stack that brought it there. */
export const ACTIVE_S = 0.82;

/* How far a piece rises into place — its route-entrance distance, 16rem. This
   is a long way, and deliberately so: a short rise on a long curve reads as
   hesitation, where a long one reads as weight. */
export const RISE = 160;

/* Its intro `activeStartScale`: what the focused card grows from. */
export const ACTIVE_FROM_SCALE = 0.8;

/* Type, which does not fade.
 *
 * The reference never animates opacity on text. A line is clipped by its own
 * box and slides up from under the edge of it, so what changes is how much of
 * the line exists rather than how solid it is. Faded type reads as a
 * screenshot dissolving; masked type reads as type being set. */
export const LINE = {
  duration: 0.55,
  ease: EASE_OUT_CUBIC,
  /* Between the lines of one block... */
  lineStagger: 0.055,
  /* ...and between blocks, which is nearly five times longer: the paragraphs
     arrive as separate events, the lines inside one as a single sweep. */
  blockStagger: 0.26,
  from: "1.15em"
} as const;

/* One card of the deck moving to the next. Not the page curve: a step is a
   small, repeatable, interruptible move, and the reference gives it a spring so
   that a second step arriving mid-flight inherits the first one's speed instead
   of restarting.

   `duration` and `bounce` are what motion resolves when both these and
   stiffness/damping are present — the stiffness and damping are carried
   verbatim from the reference anyway, because they are what it wrote. */
export const STEP_SPRING = {
  type: "spring",
  duration: 0.3,
  stiffness: 190,
  damping: 18,
  bounce: 0
} as const;
