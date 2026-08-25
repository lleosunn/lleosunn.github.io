import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { GitHubIcon, HomeIcon, LinkedInIcon, MoonIcon, ResumeIcon, SunIcon } from "../components/Icons";
import { useDeck } from "../hooks/useDeck";
import { captureHero, hasPendingHero } from "../hooks/useHeroFlight";
import { useLenis } from "../hooks/useLenis";
import { useTheme } from "../hooks/useTheme";
import { projectBySlug, projects } from "../lib/projects";
import { site } from "../lib/site";

const COPIES = 3;
const ENTER_MS = 600;

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
    lenisRef,
    count: projects.length,
    copies: COPIES,
    enabled: isHome,
    onActive
  });

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

  /* The entry animation. `is-flat` drops the 14px rise for a page receiving a
     flight: the flight measures its destination the moment the route mounts,
     and a shell still settling underneath it would make the landing jump. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("is-entering");
    if (hasPendingHero()) root.classList.add("is-flat");
    const id = setTimeout(() => root.classList.remove("is-entering", "is-flat"), ENTER_MS + 80);
    return () => {
      clearTimeout(id);
      root.classList.remove("is-entering", "is-flat");
    };
  }, [pathname]);

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
            onClick={() => captureHero(projectHero())}
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
          <Link className="icon-btn" to="/resume" aria-label="Resume">
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
