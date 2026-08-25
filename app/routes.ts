import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

/* Everything sits inside one pathless layout. That is the whole point of the
   rewrite: .shell — and with it #scroller and the Lenis instance attached to it
   — is rendered once and never unmounts, so moving between projects changes the
   contents of a pane rather than tearing down a document. */
export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("projects/:slug", "routes/project.tsx"),
    route("resume", "routes/resume.tsx")
  ])
] satisfies RouteConfig;
