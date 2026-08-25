/* Markdown -> HTML for the project pages.
 *
 * The posts were written against kramdown, which scans a raw HTML block to its
 * matching close tag. CommonMark does not: it ends an HTML block at the first
 * blank line, and four of the hand-authored SVG diagrams in the NCO post have
 * blank lines inside them. Rendered straight through `marked`, those diagrams
 * come apart halfway and the remainder is parsed as markdown.
 *
 * So the block-level HTML is lifted out before the markdown parser ever sees
 * it, and put back verbatim afterwards. Nothing inside a <figure>, <div> or
 * <table> is interpreted — which is also what kramdown did, and is why the post
 * bodies needed no edits to move here.
 */
import matter from "gray-matter";
import { marked } from "marked";

/* kramdown gave every heading an anchor and ran the text through smartypants.
   Both are visible in the current output, so both are reproduced here rather
   than accepted as drift: the headings are what any existing deep link points
   at, and the typography is what the pages have always shown. */

/* Lowercase, drop anything that is not a word character, space or hyphen, then
   turn each remaining space into one hyphen. Runs are NOT collapsed, which is
   why kramdown renders "System & Features" as "system--features" — the ampersand
   leaves two spaces behind and each becomes a hyphen. */
function slugify(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");
}

/* Applied to the rendered HTML with tag interiors skipped, so an apostrophe in
   running text becomes a curly quote while one inside an href or an alt
   attribute is left exactly as written. */
function smartypants(html) {
  return html.replace(/>([^<]+)</g, (_, text) => ">" + typo(text) + "<");
}

function typo(t) {
  return t
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/---/g, "\u2014")
    .replace(/--/g, "\u2013")
    .replace(/\.\.\./g, "\u2026")
    .replace(/"(?=[^\s])/g, "\u201c")
    .replace(/"/g, "\u201d")
    .replace(/(\w)'(\w)/g, "$1\u2019$2")
    .replace(/'(?=[^\s])/g, "\u2018")
    .replace(/'/g, "\u2019");
}

const CONTAINERS = ["figure", "div", "table"];

/* Scan from an opening tag at column 0 to its matching close at column 0,
   counting nested opens of the same tag so a <div> inside a <div> does not end
   the block early. Returns the index just past the closing line. */
function endOfBlock(lines, start, tag) {
  const open = new RegExp(`^<${tag}\\b`);
  const close = new RegExp(`^</${tag}\\s*>`);
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    if (open.test(lines[i])) depth++;
    if (close.test(lines[i])) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1; // unbalanced: leave it to the markdown parser
}

function extractRaw(body) {
  const lines = body.split("\n");
  const blocks = [];
  const out = [];

  for (let i = 0; i < lines.length; ) {
    let end = -1;

    /* Comments count as raw too. Several posts label a figure with one on the
       line directly above it, and with no blank line between the two marked
       folds the comment and the placeholder into a single paragraph — which
       leaves the restored <figure> wrapped in a <p> it was never meant to be
       inside. */
    if (/^<!--/.test(lines[i])) {
      for (let j = i; j < lines.length; j++) {
        if (/-->/.test(lines[j])) {
          end = j + 1;
          break;
        }
      }
    } else {
      const tag = CONTAINERS.find((t) => new RegExp(`^<${t}\\b`).test(lines[i]));
      if (tag) end = endOfBlock(lines, i, tag);
    }

    if (end === -1) {
      out.push(lines[i]);
      i++;
      continue;
    }
    /* A bare token fenced by blank lines. The blanks are what force marked to
       give each token a paragraph of its own: two placeholders on consecutive
       lines — a comment labelling the figure below it, which several posts do —
       would otherwise be folded into one paragraph, and the exact
       `<p>%%RAWn%%</p>` string the restore below looks for would never appear.
       The block then stays wrapped in the <p> it was supposed to replace. */
    out.push("", `%%RAW${blocks.length}%%`, "");
    blocks.push(lines.slice(i, end).join("\n"));
    i = end;
  }

  return { body: out.join("\n"), blocks };
}

export function renderMarkdown(source) {
  const { data, content } = matter(source);
  const { body, blocks } = extractRaw(content);

  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    return `<h${depth} id="${slugify(text)}">${text}</h${depth}>\n`;
  };

  let html = marked.parse(body, {
    gfm: true,
    breaks: false,
    async: false,
    renderer
  });
  html = smartypants(html);

  blocks.forEach((raw, i) => {
    html = html.replace(`<p>%%RAW${i}%%</p>`, raw).replace(`%%RAW${i}%%`, raw);
  });

  return { frontmatter: data, html };
}
