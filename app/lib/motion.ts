/* The site's one curve, one distance and one duration.
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
 * effect — a move that decelerates for half a second reads as heavy and
 * deliberate, where the same distance on a sharper curve reads as a flick.
 */

export const EASE: [number, number, number, number] = [0.32, 0, 0, 1];

/* The same curve for the places that take a CSS string: WAAPI keyframes and
   the stylesheet's own transitions. */
export const EASE_CSS = "cubic-bezier(0.32, 0, 0, 1)";

/* Seconds for motion's API, milliseconds for WAAPI's. */
export const REVEAL_S = 0.72;
export const REVEAL_MS = 720;

/* How far a piece rises into place. */
export const RISE = 28;
