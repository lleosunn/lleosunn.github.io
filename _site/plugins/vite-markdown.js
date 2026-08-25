import { renderMarkdown } from "./markdown.js";

/* Turns each project's markdown into an ES module at build time, so a route can
   `import` a project the way it imports anything else and the HTML is baked into
   the bundle rather than parsed in the browser. */
export function projectMarkdown() {
  return {
    name: "project-markdown",
    enforce: "pre",
    transform(code, id) {
      if (!/\/content\/projects\/[^/]+\.md$/.test(id)) return null;
      const { frontmatter, html } = renderMarkdown(code);
      return {
        code:
          `export const frontmatter = ${JSON.stringify(frontmatter)};\n` +
          `export const html = ${JSON.stringify(html)};\n`,
        map: null
      };
    }
  };
}
