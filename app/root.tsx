import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, useLocation } from "react-router";
import type { Route } from "./+types/root";
import { site } from "./lib/site";
import "./styles/main.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/assets/img/favicons/favicon.ico" },
  {
    rel: "preload",
    href: "/assets/fonts/inter-400-latin.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous"
  },
  {
    rel: "preload",
    href: "/assets/fonts/inter-600-latin.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous"
  }
];

/* Has to run before the first paint, which is why it is inline and not a hook:
   a theme resolved after hydration flashes the wrong one for a frame. This is
   the only piece of the old head script that survived the rewrite — the flight
   guards it also set are gone, because a flight no longer crosses a document
   boundary and has nothing to guard against. */
const THEME_SCRIPT = `(function(){var r=document.documentElement;try{var s=localStorage.getItem("theme");r.dataset.theme=s||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){r.dataset.theme="light"}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <html lang={site.lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="author" content={site.author.name} />
        <meta name="keywords" content={site.keywords.join(", ")} />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body data-page={pathname === "/" ? "home" : "inner"}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="shell">
      <main className="pane-right" style={{ padding: "var(--gutter)" }}>
        <div className="prose">
          <h2>{is404 ? "Not found" : "Something went wrong"}</h2>
          <p>
            {is404
              ? "That page does not exist."
              : "An unexpected error occurred."}
          </p>
          <p>
            <a href="/">Back to home</a>
          </p>
        </div>
      </main>
    </div>
  );
}
