# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design reference

**https://www.gabrielbeaugonin.com/ is the reference this site is aimed at.**
Match it as closely as possible — typography (family, sizes, weights, tracking,
line height), spacing and layout, colour, the split-pane structure, and above
all the motion: curves, durations, stagger, the opening, the hero flight, the
deck's feel. When a detail here is unspecified or ambiguous, the answer is
whatever the reference does. Several constants in this repo were lifted from its
bundle rather than guessed (`app/lib/motion.ts`, the idle image warming in
`app/lib/preload.ts`), and that is the preferred way to settle a question:
go look at what it actually does.

**Leo's explicit instructions override the reference.** He layers his own
changes on top of it — e.g. "make the tiles bigger" — and where his direction
and the reference disagree, his direction wins, with no argument from the
reference. Once he has overridden something, it stays overridden: do not
quietly pull it back toward the reference in later work.

So the order of authority is: Leo's stated preference > the reference site >
your own design judgement. Do not invent a look for something the reference
already answers.

## The stack is not fixed

The current dependencies — React Router, Lenis, motion, marked, gray-matter, the
hand-written Vite markdown plugin — are means, not constraints. None of them is
final. If a different library, a plugin, or no library at all would produce a
better result, propose it and use it; do not contort code to stay inside the
existing dependency list, and do not treat "that's what we already import" as a
reason. Adding, replacing, or dropping a dependency is a normal move here.

Two practical notes, not vetoes:

- The site is prerendered to static files and served by GitHub Pages, so
  anything requiring a runtime server changes the deployment story. That is a
  trade worth raising explicitly rather than a line that cannot be crossed.
- Swap deliberately and say so — a replaced library should actually replace the
  old one, not sit alongside it.

## Commands

```bash
npm install
npm run dev        # Vite dev server with HMR
npm run build      # react-router build && node scripts/postbuild.mjs -> build/client
npm run typecheck  # react-router typegen && tsc   <- the only automated check
npm run preview    # serve the built output
```

There is no test framework in this repo. `npm run typecheck` is the verification
step; CI (`.github/workflows/deploy.yml`) runs `typecheck` then `build` on every
push to `main` and publishes `build/client` to GitHub Pages.

`typegen` must run before `tsc` — route modules import their prop types from
`./+types/<route>`, which is generated into `.react-router/types/`.

## Architecture

React Router 8 in Framework Mode, `ssr: false`, prerendered to static files.
There is no server at runtime; GitHub Pages serves the output.

### Content is the source of truth

Adding a project is one markdown file in `content/projects/` — the filename is
the slug. Three build-time readers derive everything else from that directory,
and all three must keep agreeing:

| Reader | Derives |
|---|---|
| `react-router.config.ts` | the `prerender` list |
| `plugins/vite-markdown.js` | each `.md` → an ES module exporting `frontmatter` + `html` |
| `scripts/postbuild.mjs` | `sitemap.xml` (plus `404.html` from `__spa-fallback.html`, and `.nojekyll`) |

`app/lib/projects.ts` then pulls the modules in with an **eager**
`import.meta.glob`, sorted by `tile_order` and filtered on `display !== false`.
Eager is deliberate: project pages render from a synchronous import, so there is
no loader and no pending state anywhere in the app. Revisit if this grows past
a few dozen projects.

Frontmatter shape and conventions are documented in `README.md`. Notable ones:
`end_date: 9999-12-31` means "ongoing" (the sitemap omits `lastmod` for it), and
`preview_image` is the card cover when it differs from the hero `image`.

Media lives in `public/assets/`, referenced as `/assets/...`.

### Markdown rendering is kramdown-compatible on purpose

`plugins/markdown.js` reproduces the old Jekyll/kramdown output rather than
using stock CommonMark behaviour. Three things there look like bugs and are not:

- **Block HTML is lifted out before `marked` sees it** and restored verbatim.
  Several posts contain hand-authored inline SVG with blank lines inside it,
  which CommonMark would tear apart mid-diagram.
- **Heading slugs do not collapse whitespace runs**, so `System & Features`
  becomes `system--features`. Existing deep links point at these.
- **Smartypants is hand-rolled** and applied only between tags, so quotes in
  `href`/`alt` attributes stay straight.

Changing any of these changes published URLs or breaks post bodies.

### One shell that never unmounts

`app/routes.ts` puts every route inside a single pathless layout. `.shell`,
`#scroller` and the Lenis instance attached to it are created once and survive
all navigation — that is the whole reason for the React rewrite (see
`docs/superpowers/specs/2026-08-24-react-rewrite-design.md`). A route change
swaps the contents of a pane; it does not tear down a document.

The left pane is derived from `pathname` by `paneFor()` in
`app/routes/layout.tsx`, not plumbed through route `handle`s. A new route adds a
branch there.

### Navigation is three coordinated moves

A plain left click does **not** navigate immediately:

1. `useTransitionNavigate` (`app/hooks/usePageTransition.ts`) runs the exit, and
   navigates only when it finishes. The `href` stays on the anchor so
   middle-click / cmd-click / "open in new tab" still work — `isPlainClick`
   gates the interception.
2. `useHeroFlight.ts` lifts a copy of the clicked card out of `.shell` at click
   time, pinned to the viewport, so the page can clear out from under it. It
   lands on the destination hero as a FLIP with a uniform scale plus an opening
   clip (never a stretched aspect ratio).
3. `usePageEnter` plays the arriving pieces in — flat, if a flight is landing,
   so two motions never argue.

`app/lib/motion.ts` holds the site's one curve, one distance and one duration.
Everything that moves — the opening, an arrival, the flight — uses those exact
numbers; that shared identity is the effect. Do not introduce a local easing or
duration.

Two related conventions in the same subsystem:

- Animate the standalone **`translate`** property, never `transform`. The dots
  and any in-flight card already carry a `transform`, and writing to it replaces
  theirs outright.
- `.icon-row` and `.dots` are deliberately excluded from exit/enter (`CONTENT`
  in `usePageTransition.ts`). They persist because they are the same controls
  before and after. The opening is the one exception.

### The home deck

Home is not a scroll container. `useVirtualDeck.ts` owns `pos`, an unbounded
float in slot units fed directly by wheel deltas, with one no-bounce spring
detent. `useDeck.ts` turns that into per-frame geometry and writes it **straight
to `style`** — no React state on the animation path. The ring is closed by
`wrapOffset` at paint time, so each project's link exists exactly once in the
DOM and stays focusable.

Because home does not scroll, `layout.tsx` calls `lenis.stop()` there and
`lenis.start()` elsewhere; the instance itself is never recreated. Lenis caches
its scroll limit, so route changes and a `ResizeObserver` on the pane's child
both trigger `lenis.resize()`.

### Anything that must precede the first paint goes in the inline head script

`HEAD_SCRIPT` in `app/root.tsx` sets the resolved theme and the `data-boot`
attribute before the browser paints. The site is prerendered, so a class added
by React arrives *after* the paint it was meant to prevent. The script also arms
a timer that clears `data-boot` on its own, so a page whose bundle never loads
still becomes readable. `useBootReveal.ts` is the other half.

## Gotchas

- **`_site/` is a stale committed snapshot of an older source tree**, not build
  output and not generated by anything current. Editing files there has no
  effect. The live source is `app/`, `content/`, `plugins/`, `scripts/`.
- Build output is `build/client` (gitignored), and `postbuild.mjs` must run
  after `react-router build` or Pages loses `.nojekyll`, `404.html` and the
  sitemap.
- `~/*` maps to `./app/*` in `tsconfig.json`, though most files use relative
  imports.
