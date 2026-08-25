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

/* Has to run before the first paint, which is why it is inline and not a hook.
   Both halves are the same argument.

   The theme: one resolved after hydration flashes the wrong one for a frame.

   data-boot: the site is prerendered, so without it the browser paints finished
   markup — and then hydration seats the deck on top of what was already on
   screen. CSS hides the panes' contents while the attribute is there and
   useBootReveal takes it off to play the opening; a class added by React would
   arrive after the paint it was meant to prevent.

   The timer is the promise that a bundle which never loads still leaves a
   readable page. It hands over to data-boot-late rather than simply dropping
   the curtain, so that the one path where the script that owns the opening
   never ran is still a fade and not a flash — and then clears that too, or the
   attribute would sit on <html> animating every element a later navigation
   mounted. */
const HEAD_SCRIPT = `(function(){var r=document.documentElement;try{var s=localStorage.getItem("theme");r.dataset.theme=s||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){r.dataset.theme="light"}try{if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){r.setAttribute("data-boot","");window.__boot=setTimeout(function(){if(!r.hasAttribute("data-boot"))return;r.setAttribute("data-boot-late","");r.removeAttribute("data-boot");setTimeout(function(){r.removeAttribute("data-boot-late")},900)},2500)}}catch(e){}})();`;

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
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
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
