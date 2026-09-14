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

   data-load: the same argument again, one layer up. The curtain below ships in
   the prerendered markup, because a panel React mounts after hydration is a
   panel that drops on top of a page the reader has already seen — the exact
   pop it exists to prevent, staged in reverse. So it is always in the document
   and CSS keeps it hidden until this attribute says otherwise. A reader who
   asked not to be animated at never gets either attribute, and a visitor whose
   script never runs at all is simply handed the page.

   The timer is the promise that a bundle which never loads still leaves a
   readable page. It takes the curtain off first and unconditionally — whatever
   state the rest of the boot is in, two and a half seconds is the longest
   anyone waits behind a title card — and then hands over to data-boot-late
   rather than simply dropping the inner curtain, so that the one path where the
   script that owns the opening never ran is still a fade and not a flash. It
   clears that too, or the attribute would sit on <html> animating every element
   a later navigation mounted.

   The curtain needs no such handover: it leaves on a CSS transition keyed to
   the attribute's absence, so removing it here fades the panel exactly the way
   useBootReveal's own removal does. One exit, both paths. */
const HEAD_SCRIPT = `(function(){var r=document.documentElement;try{var s=localStorage.getItem("theme");r.dataset.theme=s||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){r.dataset.theme="light"}try{if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){r.setAttribute("data-boot","");r.setAttribute("data-load","");window.__boot=setTimeout(function(){r.removeAttribute("data-load");if(!r.hasAttribute("data-boot"))return;r.setAttribute("data-boot-late","");r.removeAttribute("data-boot");setTimeout(function(){r.removeAttribute("data-boot-late")},900)},2500)}}catch(e){}})();`;

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
        {/* The title card. Prerendered into every page and hidden by CSS until
            the head script says otherwise; see the note above for why it cannot
            be mounted by React. aria-hidden because it is a second copy of a
            name the page is about to say properly — a screen reader should hear
            the real heading, not this one, and it is gone before the reader
            could reach it in any case. */}
        <div className="curtain" aria-hidden="true">
          <div className="curtain__inner">
            <div className="curtain__mask">
              <div className="curtain__word">{site.title}</div>
            </div>
            <div className="curtain__rule" />
          </div>
        </div>
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
