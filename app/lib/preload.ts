/* Image warming.
 *
 * Two moments want an image in the cache before it is needed, and the
 * reference (gabrielbeaugonin.com) handles both the same way: never block, but
 * do not arrive on a blank either.
 *
 *   - Idle: once the opening has played, every card and hero on the site is
 *     fetched in small batches under requestIdleCallback, so the deck a reader
 *     wheels through and the project they land on are already decoded.
 *   - Click: the one hero about to be flown to is raced against a cap. If it
 *     is cached the race is over in the same tick; if it is not, the wait is
 *     bounded and the exit is usually still running anyway.
 */

/* Enough to saturate a connection, few enough that the batch after it is not
   queued behind a single slow file. */
const BATCH = 4;

/* Their number. Long enough for a warm image on a middling connection, short
   enough that a cold one never reads as the site having hung. */
export const WARM_CAP = 520;

/* The opening's own cap, and much longer, because the two waits are not the
   same wait. WARM_CAP runs while a navigation is already visibly under way and
   is only buying the flight a decoded image to land on; overrun it and the
   flight blinks once. This one runs before the site has shown anything at all,
   and the reference is willing to spend three full seconds on it rather than
   open onto a page whose first picture is still arriving. Their number too. */
export const BOOT_CAP = 3000;

const after = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* Resolves on decode, not merely on load: an image that has arrived but not
   been decoded still costs a frame the first time it is painted. Never
   rejects — a missing file is not worth failing a navigation over. */
function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = () => {
      if (typeof img.decode === "function") img.decode().then(done, done);
      else done();
    };
    img.onerror = done;
    img.src = src;
  });
}

export async function preloadImages(sources: (string | undefined)[]) {
  const list = [...new Set(sources.filter((s): s is string => Boolean(s)))];
  for (let i = 0; i < list.length; i += BATCH) {
    await Promise.all(list.slice(i, i + BATCH).map(loadImage));
  }
}

/* Fire and forget, at the browser's convenience. The timeout is the promise
   that it happens at all on a tab that never goes idle. */
export function preloadWhenIdle(sources: (string | undefined)[]) {
  if (typeof window === "undefined") return;
  const run = () => void preloadImages(sources);
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 250);
  }
}

/* One image, waited on but not depended upon. */
export function warm(src: string | undefined, cap = WARM_CAP): Promise<void> {
  if (!src) return Promise.resolve();
  return Promise.race([loadImage(src), after(cap)]);
}
