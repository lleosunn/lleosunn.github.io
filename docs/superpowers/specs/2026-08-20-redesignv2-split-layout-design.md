# redesignv2 — Split-Pane Portfolio Redesign

**Date:** 2026-08-20
**Branch:** `redesignv2`
**Status:** Approved design, pending implementation

## Goal

Replace the current 3-column tile gallery with a two-pane layout: a fixed
identity pane on the left and an independently scrolling column of project
tiles on the right. Visual direction follows gabrielbeaugonin.com — Swiss
grayscale, a single font weight, no smooth scrolling.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Stack | Stay on Jekyll | Design is ~95% CSS; migration buys little |
| Navigation | Real page loads + View Transitions | Cross-fade polish, no router to own |
| Font | Inter, self-hosted | Suisse Int'l is commercially licensed; cannot rehost |
| Weights | 400 only | Matches reference discipline; hierarchy via size + gray |
| Dots | Home page only, one per project | Explicit user choice |
| Left pane | Name + tagline + icons, nothing else | Maximum restraint |
| Icon row | Left pane, under the tagline (desktop) | Explicit user choice |
| Mobile | Fixed top identity, scrolling tiles, fixed bottom icons | Explicit user choice |

## Palette

Grayscale in both themes. Values derived from the reference site.

```
Light                       Dark
--bg:      #ffffff          --bg:      #0a0a0a
--surface: #f6f6f6          --surface: #1a1a1a
--text:    #0a0a0a          --text:    #ffffff
--muted:   #9f9f9f          --muted:   #9f9f9f
```

`--muted` is deliberately identical across themes — it passes contrast on both
grounds and keeps secondary text consistent.

## Layout

### Desktop (>= 900px)

The page shell is exactly viewport-height and never scrolls. Only the right
pane scrolls.

```
+-----------------------+--------------------------------+---+
|                       |                                | o |
|  Leo Sun              |   [ project tile ]             | o |
|  MIT Class of 2028    |   Title      description       | * |
|                       |                                | o |
|  [home][in][gh]       |   [ project tile ]             | o |
|  [cv][theme]          |   Title      description       | o |
|                       |                                |   |
+-----------------------+--------------------------------+---+
   fixed, does not scroll    overflow-y: auto            dots
```

- Shell: `height: 100dvh; overflow: hidden`, CSS grid `[left] [right]`
- Left pane fixed width, `clamp(300px, 30vw, 420px)`
- Right pane `overflow-y: auto`, holds the scrolling content
- Dots fixed to the right edge, vertically centered, home page only

### Mobile (< 900px)

Three zones on a `100dvh` grid of `auto 1fr auto`. The tiles are the only
scrolling region; identity and icons stay pinned.

```
+-------------------------------+
| Leo Sun                       |  fixed
| MIT Class of 2028             |
+-------------------------------+
|   [ project tile ]            |  scrolls
|   [ project tile ]            |
+-------------------------------+
| [home] [in] [gh] [cv] [theme] |  fixed
+-------------------------------+
```

Dots hide below 900px.

## Left pane is context-dependent

The same region renders different content per page type. This is the core
structural idea — one layout slot, three sources.

| Page | Line 1 | Line 2 | Line 3 |
|---|---|---|---|
| Home | `site.title` | `site.tagline` | — |
| Project | `page.title` | `page.description` | `page.years` |
| Resume/page | `page.title` | `page.description` | — |

Implemented in `_layouts/default.html` by capturing the three values, with
each child layout overriding them. No duplication across layouts.

## Project tiles

Single column, one tile per row, full width of the right pane. Image on top
with an 8px radius; below it the title in `--text` and the description in
`--muted`. Text sits below the image rather than overlaying it — overlay text
needs scrims and bold weights, which fight the single-weight grayscale
direction.

Source stays `preview_image.path` falling back to `image.path`, ordered by
`tile_order`, skipping `display: false`. No front-matter changes needed.

The per-project `object-position` hacks currently in `main.css`
(`.project-tile--mit-motorsports-driverless` etc.) move into optional
front matter so the stylesheet stops knowing project names:

```yaml
preview_image:
  path: ...
  position: "40% center"   # optional
```

## Dots

- One dot per visible project, rendered on the home page only
- `IntersectionObserver` on the tiles sets the active dot
- Clicking a dot jumps to that tile instantly (no smooth behavior)
- `aria-label` per dot with the project title; the strip is `role="navigation"`

## Scroll behavior

Smooth scrolling is removed globally — `scroll-behavior: smooth` comes out of
`html`, and all programmatic scrolls use the default instant behavior.

Returning home via the home icon restores the previous tile-scroll position.
The right pane's `scrollTop` is written to `sessionStorage` on navigation away
from home and restored on load. Roughly ten lines; not tied to the navigation
choice.

## View Transitions

```css
@view-transition { navigation: auto; }
```

The left pane and right pane get distinct `view-transition-name` values so the
identity block cross-fades while the content pane fades independently.
Unsupported browsers get an ordinary page load. Wrapped in a
`prefers-reduced-motion: no-preference` guard.

## Icons

FontAwesome is currently loaded in full for five glyphs. It is replaced by
inline SVG in a new `_includes/icons.html`, removing a render-blocking
stylesheet and the `assets/lib/fontawesome-free` dependency from the critical
path.

Icons: home, LinkedIn, GitHub, resume, theme toggle. `resume.html` also uses
`fa-file-pdf` for its download link, so it converts to the same include —
otherwise removing the FontAwesome stylesheet leaves a blank glyph there.

Verified: FontAwesome is 1.1 MB serving six glyphs total.

## Files

**Rewritten**
- `_layouts/default.html` — shell grid, left pane, right pane, icons, dots
- `_layouts/home.html` — tile column
- `_layouts/post.html` — project content into right pane
- `_layouts/page.html` — resume and simple pages
- `assets/css/main.css` — full rewrite against the new token set

**New**
- `_includes/icons.html` — inline SVG sprite
- `assets/js/nav.js` — dots, scroll restoration
- `assets/fonts/` — self-hosted Inter woff2 (OFL-1.1)

**Unchanged**
- `assets/js/theme.js` — already correct
- `_includes/seo.html`, `metadata-hook.html`
- All 11 posts, except optional `preview_image.position` additions

**Removed**
- `_tabs/resume.md` — verified dead: `_tabs` is not a declared collection in
  `_config.yml`, so Jekyll never builds it. `/resume/` comes from `resume.html`.
- FontAwesome `<link>` from the critical path

## Out of scope

Content rewrites, new pages, project-page internal redesign beyond fitting the
right pane, and image optimization.
