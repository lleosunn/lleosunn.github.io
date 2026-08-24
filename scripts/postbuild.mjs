/* Everything GitHub Pages needs that the bundler does not emit.
 *
 * Run after `react-router build`. Three jobs:
 *   - sitemap.xml, which used to be a Liquid template in the repo root
 *   - 404.html, so a URL with no prerendered document still boots the app
 *     instead of showing Pages' own 404
 *   - .nojekyll, so Pages serves the output as-is rather than running its
 *     built-in Jekyll over it — which would drop __spa-fallback.html and
 *     anything else whose name starts with an underscore
 */
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import matter from "gray-matter";

const OUT = "build/client";
const URL_BASE = "https://www.leosun.org";

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const projects = readdirSync("content/projects")
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({
    slug: f.replace(/\.md$/, ""),
    ...matter(readFileSync(`content/projects/${f}`, "utf8")).data
  }))
  .filter((p) => p.display !== false)
  // Same ordering the Liquid template used: most recently finished first.
  // Compared as ISO, not as String(value): YAML parses an unquoted date into a
  // Date, whose default string form starts with the weekday — sorting those
  // lexically orders the sitemap by the name of the day.
  .sort((a, b) => iso(b.end_date).localeCompare(iso(a.end_date)));

const url = (loc, freq, priority, lastmod) =>
  `  <url>\n    <loc>${loc}</loc>\n` +
  (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : "") +
  `    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  [
    url(`${URL_BASE}/`, "monthly", "1.0"),
    url(`${URL_BASE}/resume/`, "monthly", "0.8"),
    ...projects.map((p) =>
      url(
        `${URL_BASE}/projects/${p.slug}/`,
        "monthly",
        "0.9",
        // 9999-12-31 is the front matter's way of saying "ongoing".
        iso(p.end_date).startsWith("9999") ? undefined : iso(p.end_date)
      )
    )
  ].join("\n") +
  `\n</urlset>\n`;

writeFileSync(`${OUT}/sitemap.xml`, sitemap);
copyFileSync(`${OUT}/__spa-fallback.html`, `${OUT}/404.html`);
writeFileSync(`${OUT}/.nojekyll`, "");

console.log(`postbuild: sitemap.xml (${projects.length + 2} urls), 404.html, .nojekyll`);
