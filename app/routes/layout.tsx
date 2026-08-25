import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { GitHubIcon, HomeIcon, LinkedInIcon, MoonIcon, ResumeIcon, SunIcon } from "../components/Icons";
import { useBootReveal } from "../hooks/useBootReveal";
import { useDeck } from "../hooks/useDeck";
import { captureHero } from "../hooks/useHeroFlight";
import { isPlainClick, usePageEnter, useTransitionNavigate } from "../hooks/usePageTransition";
import { useLenis } from "../hooks/useLenis";
import { useTheme } from "../hooks/useTheme";
import { projectBySlug, projects } from "../lib/projects";
import { site } from "../lib/site";

/* The left pane is one slot fed from three sources, the same way default.html
   fed it: the site on the home page, the project's own front matter on a
   project, a fixed pair on /resume.

   Derived from the path rather than plumbed down through route `handle`s. The
   route set is four entries and stable, and reading it here keeps the pane a
   plain function of the URL — no context, no double render, and nothing for a
   new route to forget to provide. */
function paneFor(pathname: string) {
  if (pathname === "/") {
    return { title: site.title, sub: site.tagline, meta: null };
  }
  if (pathname.startsWith("/resume")) {
    return { title: "Resume", sub: "Current resume as a PDF.", meta: null };
  }
  const slug = pathname.replace(/^\/projects\//, "").replace(/\/$/, "");
  const project = projectBySlug(slug);
  return project
    ? { title: project.title, sub: project.description, meta: project.years }
    : { title: site.title, sub: site.tagline, meta: null };
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useLenis(scrollerRef);
  const { theme, toggle } = useTheme();
  const [active, setActive] = useState(0);

  const onActive = useCallback((index: number) => setActive(index), []);

  const { scrollToIndex } = useDeck({
    scrollerRef,
    count: projects.length,
    enabled: isHome,
    onActive
  });

  /* Home is not a scroll container any more — useVirtualDeck owns the wheel
     there and derives the deck's position from it directly. Lenis smoothing a
     scrollTop nothing reads would only fight that, so it stands down for the
     duration and picks up again on the pages that do scroll. The instance is
     kept either way: it is created once in this layout and outliving every
     navigation is the point of it. */
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (isHome) lenis.stop();
    else lenis.start();
  }, [isHome, lenisRef]);

  /* Lenis caches the scroll limit, and the pane's own box never changes — only
     what is inside it does. Re-measuring on the route change catches the swap,
     and the observer catches prose growing afterwards as its images arrive. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    const lenis = lenisRef.current;
    if (!scroller) return;

    if (!isHome) {
      scroller.scrollTop = 0;
      lenis?.scrollTo(0, { immediate: true, force: true });
    }
    lenis?.resize();

    const child = scroller.firstElementChild;
    if (!child) return;
    const observer = new ResizeObserver(() => lenis?.resize());
    observer.observe(child);
    return () => observer.disconnect();
  }, [pathname, isHome, lenisRef]);

  /* The opening, then every arrival after it.
   *
   * useBootReveal is called after useDeck deliberately: effects run in call
   * order, so the wheel has measured the pane and written every card's seat
   * before the reveal is even considered. All of that happens behind the
   * curtain data-boot holds up, which is why the deck no longer snaps into
   * place in front of the reader on a cold load.
   *
   * usePageEnter is the same rise on the same curve for a route change. What
   * used to be here was a class on <html> driving a keyframe over the whole
   * shell — one opacity for the entire page, which is why everything landed at
   * once. The pieces are staggered individually now, and a page receiving a
   * flight drops the rise so the two motions do not argue. */
  useBootReveal();
  usePageEnter();
  const go = useTransitionNavigate();

  const pane = paneFor(pathname);
  const projectHero = () =>
    document.querySelector<HTMLElement>(".project__media img, .project__media video");

  return (
    <div className="shell">
      <aside className="pane-left">
        <div className="identity">
          <h1 className="identity__title">{pane.title}</h1>
          {pane.sub && <p className="identity__sub">{pane.sub}</p>}
          {pane.meta && <p className="identity__meta">{pane.meta}</p>}
        </div>

        {/* Sibling of .identity, not a child: on mobile .pane-left becomes
            display:contents so these two land at opposite ends of the grid. */}
        <nav className="icon-row" aria-label="Primary">
          <Link
            className={`icon-btn${isHome ? " is-current" : ""}`}
            to="/"
            aria-label="Home"
            aria-current={isHome ? "page" : undefined}
            onClick={(event) => {
              if (!isPlainClick(event) || isHome) return;
              event.preventDefault();
              go("/", () => captureHero(projectHero()));
            }}
          >
            <HomeIcon />
          </Link>
          <a
            className="icon-btn"
            href={`https://www.linkedin.com/in/${site.linkedin}/`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
          >
            <LinkedInIcon />
          </a>
          <a
            className="icon-btn"
            href={`https://github.com/${site.github}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <GitHubIcon />
          </a>
          <Link
            className="icon-btn"
            to="/resume"
            aria-label="Resume"
            onClick={(event) => {
              if (!isPlainClick(event) || pathname.startsWith("/resume")) return;
              event.preventDefault();
              go("/resume");
            }}
          >
            <ResumeIcon />
          </Link>
          <button
            className="icon-btn theme-toggle"
            type="button"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-pressed={theme === "dark"}
            onClick={toggle}
          >
            <span className="theme-toggle__icon theme-toggle__icon--dark">
              <MoonIcon />
            </span>
            <span className="theme-toggle__icon theme-toggle__icon--light">
              <SunIcon />
            </span>
          </button>
        </nav>
      </aside>

      <div className="pane-right" id="scroller" ref={scrollerRef}>
        <Outlet />
      </div>

      {isHome && (
        <nav className="dots" aria-label="Project navigation">
          {projects.map((project, index) => (
            <button
              key={project.slug}
              className="dot"
              type="button"
              aria-label={project.title}
              aria-current={index === active ? "true" : "false"}
              onClick={() => scrollToIndex(index)}
            />
          ))}
        </nav>
      )}
    </div>
  );
}
