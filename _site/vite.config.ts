import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { projectMarkdown } from "./plugins/vite-markdown.js";

export default defineConfig({
  plugins: [projectMarkdown(), reactRouter()],
  resolve: { tsconfigPaths: true }
});
