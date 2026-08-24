import type { Config } from "@react-router/dev/config";
import { readdirSync, readFileSync } from "node:fs";
import matter from "gray-matter";

/* The prerender list is derived from the content directory, not maintained
   beside it: dropping a markdown file into content/projects is the whole
   ceremony for adding a project, exactly as dropping one into _posts was. */
const slugs = readdirSync("content/projects")
  .filter((f) => f.endsWith(".md"))
  .filter((f) => {
    const { data } = matter(readFileSync(`content/projects/${f}`, "utf8"));
    return data.display !== false;
  })
  .map((f) => f.replace(/\.md$/, ""));

export default {
  // No runtime server: GitHub Pages serves files.
  ssr: false,
  // Every route becomes a real document, so the project pages stay crawlable
  // and keep their link previews. They hydrate into an SPA afterwards, which is
  // what makes navigation between them a swap rather than a load.
  prerender: ["/", "/resume", ...slugs.map((s) => `/projects/${s}`)]
} satisfies Config;
