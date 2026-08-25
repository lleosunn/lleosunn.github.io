# leosun.org

Personal site. React Router 8 (Framework Mode) on Vite, prerendered to static
files and served by GitHub Pages.

```bash
npm install
npm run dev        # dev server with HMR
npm run build      # prerender into build/client
npm run typecheck
```

## Adding a project

Write one markdown file in `content/projects/`. The filename is the slug.

```yaml
---
title: Project Name
description: One sentence. Shown in the left pane and as the meta description.
years: "Jan 2026 - May 2026"
slug: project-name
tile_order: 1          # 1 is the top of the home deck
display: true
date: 2026-01-01
end_date: 2026-05-31   # 9999-12-31 means ongoing
image:
  path: /assets/img/.../hero.jpg
  alt: Describe the image
preview_image:         # optional; the card cover, when it differs from the hero
  path: /assets/img/.../tile.jpg
  alt: Describe the image
  position: "40% center"
hero_video:            # optional; replaces the hero image
  path: /assets/video/.../demo.mp4
  poster: /assets/img/.../poster.jpg
  caption: What the clip shows
---
```

Nothing else needs editing — the route, the prerender list, the home deck, the
dots and the sitemap all read the content directory.

Media goes in `public/assets/`, referenced as `/assets/...`.

## Layout

| Path | What |
|---|---|
| `app/routes/layout.tsx` | `.shell` — persists across navigations, so the Lenis instance survives |
| `app/hooks/useDeck.ts` | the home wheel: geometry, loop, snap, dots |
| `app/hooks/useHeroFlight.ts` | the card that morphs into a project's hero |
| `app/hooks/useLenis.ts` | smooth scrolling on the right pane |
| `plugins/markdown.js` | markdown → HTML at build time, raw HTML passed through untouched |
| `scripts/postbuild.mjs` | sitemap.xml, 404.html, .nojekyll |

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes
`build/client` to GitHub Pages.
