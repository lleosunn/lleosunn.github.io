# React rewrite

Date: 2026-08-24
Status: implemented
Branch: redesignv2

## Why

The site's page transitions are hand-rolled around a document boundary. Every
click is a real navigation: the browser destroys the document, and `transitions.js`
has to smuggle the hero's geometry across in `sessionStorage`, fade blind for
240ms before the URL changes, and give up after a 400ms deadline if the
destination hero has not become measurable. The reference the design is aimed at
(gabrielbeaugonin.com) has none of that machinery because it never unloads the
document.

The decision is to reach that behaviour by rewriting the site in React rather
than by adding fetch-and-swap to the Jekyll site. Both were costed; React was
chosen deliberately.

## Stack

| Piece | Choice | Version |
|---|---|---|
| Bundler | Vite | 8.2.2 |
| UI | React | 19.2.8 |
| Router | React Router, **Framework Mode** | 8.3.0 |
| Language | TypeScript | 5.x |
| Scroll | Lenis (unchanged) | 1.3.26 |

`react-router.config.ts` uses `ssr: false` + `prerender: true`. This emits a real
`.html` per route at build time and hydrates into an SPA, so project pages stay
crawlable and keep their link previews while navigation between them is a
client-side swap with no reload. Framework Mode is required — `prerender` does
not exist in Declarative or Data mode.

Host stays GitHub Pages on `leosun.org`. A build-and-deploy Action replaces the
built-in Jekyll build.

## Content pipeline

`_posts/*.md` -> `content/projects/*.md`. Front matter is unchanged:
`title`, `description`, `years`, `slug`, `tile_order`, `display`, `date`,
`end_date`, `image{path,alt,position?}`, `preview_image{...}`,
`hero_video{path,poster,type,caption}`.

**Markdown is rendered to an HTML string at build time and injected with
`dangerouslySetInnerHTML`** — not MDX, not react-markdown.

The reason is the NCO post: it carries ~155 raw HTML tags, mostly hand-authored
inline SVG diagrams using `class=` and self-closing `<path/>`. MDX parses raw
HTML as JSX and would require converting every one of them. Rendering to HTML
matches what kramdown does today, byte for byte, and requires no edits to any
post body. The content is first-party, so `dangerouslySetInnerHTML` carries no
untrusted-input risk.

No syntax highlighter: no post contains a fenced code block.

`assets/` moves to `public/assets/` at identical paths, so every `/assets/...`
reference in front matter and prose keeps resolving without edits.

Adding a project stays "write one markdown file" — the route list and the
prerender path list are both derived from the content directory.

## Structure

```
app/
  root.tsx              <html>/<head>, global CSS, pre-paint theme script
  routes.ts             route table
  routes/
    layout.tsx          .shell — the persistent frame
    home.tsx            the deck
    project.tsx         hero + prose
    resume.tsx
  components/           Identity, IconRow, Icons, Dots, Tiles
  hooks/                useLenis, useDeck, useHeroFlight, useTheme
  lib/projects.ts       typed content index
content/projects/*.md
public/assets/...
```

`layout.tsx` holds `.shell` and never unmounts across navigations. `#scroller`
stays the same live DOM node, so the Lenis instance survives a route change.
That single property is what the whole rewrite is for.

## The imperative parts

`nav.js` is ~450 lines of per-frame `offsetTop` / `getBoundingClientRect` reads.
It is **not** rewritten as React. It becomes `useDeck(scrollerRef)`: a near
verbatim port inside `useLayoutEffect` that measures and writes transforms
directly. React renders the tile DOM; the hook animates it. No per-frame value
is ever React state.

`useHeroFlight` gets simpler than the code it replaces. Source and destination
coexist in one document, so `sessionStorage`, the 400ms measurement deadline,
and the `is-hero-in` / `is-flat` guard classes are all deleted.

No animation library. The existing Web Animations API code ports directly.

## CSS

`assets/css/main.css` ports near-verbatim as one global stylesheet. Not CSS
modules: pixel-identical is the goal and the selectors already match the DOM
React will emit. Only the "Page transitions" section shrinks.

The three changes made on 2026-08-24 before this rewrite carry over as-is:
Lenis `duration` 0.7, `wheelMultiplier` 1.35, deck snap 0.26/0.52, and
`.project .prose { max-width: none }`.

## Removed

`_layouts/`, `_includes/`, `_config.yml`, `Gemfile`, `Gemfile.lock`, `tools/`,
`_site/`, `.jekyll-cache/`, `index.html`, `resume.html`, and the `assets/lib`
submodule (a leftover Chirpy dependency, 23MB, referenced nowhere).

`_includes/seo.html` — including its JSON-LD Person/WebSite graph — and the
hand-written `sitemap.xml` are reimplemented, not dropped: per-route `meta`
exports plus a build-time sitemap generator.

## Verification performed

Both builds were produced and diffed before the Jekyll files were removed.

- **Prose HTML: 11 of 12 posts byte-identical** to Jekyll's output once
  serialization style is normalised (`<hr />` vs `<hr>`, `autoplay=""` vs
  `autoplay`, insignificant whitespace).
- **The 12th is a fix, not a regression.** In rss-autonomous-car, kramdown reads
  the two asterisks in `A*. A* produced...` as an emphasis pair and renders
  `A<em>. A</em>`, italicising ". A" on the live site. marked renders them as
  the literal text they are.
- **DOM skeleton identical** for home, project and resume across the whole
  document; the only extra nodes are React's hydration scaffolding after the
  last element.
- Sitemap emits the same 14 URLs in the same order, bar two projects that share
  an `end_date` and tie-break differently.
- 14/14 routes serve 200 with correct titles; 66/66 `/assets/` references in the
  built HTML resolve.

Three differences are deliberate and documented above: bare `<code>` instead of
Rouge's unused `language-plaintext highlighter-rouge` classes, source-faithful
rather than re-serialised raw HTML, and the `A*` fix.

## Risks

- The deck port was the highest-risk item by a wide margin. It is a line-for-line
  port of the geometry; what changed is only the lifecycle around it.

## Manual step for the repo owner

GitHub Pages must be switched from "Deploy from a branch" to "GitHub Actions" in
repository settings. This cannot be done from the codebase. `CNAME` is copied
into the build output so the custom domain survives.
