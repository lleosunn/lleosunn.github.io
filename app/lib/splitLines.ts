/* Type, split into its own lines so each can be clipped by the box it sits in.
 *
 * The reference (gabrielbeaugonin.com) never fades text. A line slides up from
 * under the edge of a mask, and what changes over the animation is how much of
 * the line exists rather than how solid it is. That difference is most of why
 * its pages read as being typeset rather than as a screenshot dissolving in,
 * and it cannot be had without knowing where the lines are — which is a
 * measurement, not something the markup says.
 *
 * So: wrap every word, ask the browser where each one landed, group the ones
 * that share a top edge, and rebuild the block with one clipping wrapper per
 * group. Then put the original markup back the moment the animation is over.
 * Restoring is not tidiness. A block held in split form has the wrong number of
 * elements in it for the rest of its life: it will not reflow when the window
 * changes, a double-click selects one word instead of one line, and copying it
 * yields text with the line breaks baked in. Splitting is a costume worn for
 * half a second, never a representation.
 *
 * The markup this runs over comes from plugins/markdown.js, which is
 * deliberately kramdown-compatible and passes hand-authored inline SVG through
 * untouched. Anything with a replaced or preformatted element in it is left
 * alone entirely — see `splittable`.
 */

const WORD = "sl-word";

/* Elements that are a single unbreakable thing rather than a run of words.
   They become one "word" and are never recursed into. */
const ATOMIC = /^(CODE|KBD|ABBR|TIME|SUP|SUB|BR)$/;

/* If a block contains any of these, it is not type and does not get split: the
   line box is set by something that is not a line, and a mask sized to it would
   clip a picture in half. */
const NOT_TYPE = "img, svg, video, iframe, pre, table, figure, canvas, object";

export interface Split {
  /* The inner span of each line — the thing that moves. The outer one is the
     mask and stays where it is. */
  lines: HTMLElement[];
  restore: () => void;
}

export function splittable(el: HTMLElement): boolean {
  if (el.querySelector(NOT_TYPE)) return false;
  return el.textContent!.trim().length > 0;
}

/* --- Wrapping ----------------------------------------------------------- */

/* Every word gets a span of its own, in place, so a word inside an <a> is still
   inside that <a> when it is measured. Whitespace is dropped from the DOM and
   remembered as a flag instead: the rebuild below moves words between parents,
   and a space that survived as a text node would be left behind in the old one.
*/
function wrap(block: HTMLElement): HTMLElement[] {
  const words: HTMLElement[] = [];
  let pendingSpace = false;

  const walk = (parent: Node) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";
        // Keeps the separators, so a run of whitespace is visible as one.
        for (const part of text.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            pendingSpace = true;
            continue;
          }
          const span = document.createElement("span");
          span.className = WORD;
          if (pendingSpace) span.dataset.space = "";
          span.textContent = part;
          parent.insertBefore(span, node);
          words.push(span);
          pendingSpace = false;
        }
        parent.removeChild(node);
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as HTMLElement;

      if (ATOMIC.test(el.tagName)) {
        const span = document.createElement("span");
        span.className = WORD;
        if (pendingSpace) span.dataset.space = "";
        parent.insertBefore(span, el);
        span.appendChild(el);
        words.push(span);
        pendingSpace = false;
        continue;
      }

      walk(el);
    }
  };

  walk(block);
  return words;
}

/* --- Measuring ---------------------------------------------------------- */

/* Words that share a top edge share a line. The tolerance is for the ones that
   do not quite: an inline <code> sets its own line box and can sit a pixel or
   two off the run it is part of, and a break there would put half a sentence on
   its own mask. */
const TOLERANCE = 3;

function group(words: HTMLElement[]): HTMLElement[][] {
  const lines: HTMLElement[][] = [];
  let top = NaN;
  for (const word of words) {
    const here = word.getBoundingClientRect().top;
    if (!lines.length || Math.abs(here - top) > TOLERANCE) {
      lines.push([]);
      top = here;
    }
    lines[lines.length - 1].push(word);
  }
  return lines;
}

/* --- Rebuilding --------------------------------------------------------- */

/* A word carries its inline ancestors with it. When a link straddles a line
   break the two halves need an <a> each — one per line — or the second half
   loses its styling and its href, so the chain is cloned per line and shared by
   every word on that line that came from it. */
function reparent(
  node: HTMLElement,
  block: HTMLElement,
  root: HTMLElement,
  clones: Map<HTMLElement, HTMLElement>
): HTMLElement {
  if (node === block) return root;
  const parent = reparent(node.parentElement!, block, root, clones);
  let clone = clones.get(node);
  if (!clone) {
    clone = node.cloneNode(false) as HTMLElement;
    clones.set(node, clone);
    parent.appendChild(clone);
  }
  return clone;
}

function chain(word: HTMLElement, block: HTMLElement): HTMLElement[] {
  const path: HTMLElement[] = [];
  for (let el = word.parentElement; el && el !== block; el = el.parentElement) {
    path.unshift(el);
  }
  return path;
}

/* Where the space between two words belongs.
 *
 * Not inside either of them. `<a>foo</a> bar` with the space appended to the
 * link underlines it, and `foo <a>bar</a>` with the space appended to the link
 * indents the link by a space that is part of the sentence, not the target.
 * The deepest element both words are inside is the one place it can sit and be
 * neither — and because clones are appended in word order, appending there puts
 * it exactly between them. */
function seam(
  previous: HTMLElement,
  word: HTMLElement,
  block: HTMLElement,
  root: HTMLElement,
  clones: Map<HTMLElement, HTMLElement>
): HTMLElement {
  const a = chain(previous, block);
  const b = chain(word, block);
  let depth = 0;
  while (depth < a.length && depth < b.length && a[depth] === b[depth]) depth++;
  return depth === 0 ? root : clones.get(a[depth - 1]) ?? root;
}

export function splitLines(block: HTMLElement): Split | null {
  const snapshot = block.innerHTML;
  const undo = () => {
    block.innerHTML = snapshot;
  };

  const words = wrap(block);
  if (!words.length) {
    undo();
    return null;
  }

  const grouped = group(words);
  const lines: HTMLElement[] = [];

  const fragment = document.createDocumentFragment();
  for (const run of grouped) {
    const mask = document.createElement("span");
    mask.className = "line";
    const inner = document.createElement("span");
    inner.className = "line__i";
    mask.appendChild(inner);

    const clones = new Map<HTMLElement, HTMLElement>();
    for (const [index, word] of run.entries()) {
      // The first word of a line never carries its leading space: it would show
      // as an indent that only the second line onwards has.
      if (index > 0 && word.dataset.space !== undefined) {
        seam(run[index - 1], word, block, inner, clones).appendChild(
          document.createTextNode(" ")
        );
      }
      reparent(word.parentElement!, block, inner, clones).appendChild(word);
    }

    fragment.appendChild(mask);
    lines.push(inner);
  }

  block.replaceChildren(fragment);
  return { lines, restore: undo };
}
