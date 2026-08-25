import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { Link, useLocation, useOutlet } from "react-router";
import { animate } from "motion";
import { GitHubIcon, HomeIcon, LinkedInIcon, MoonIcon, ResumeIcon, SunIcon } from "../components/Icons";
import { useBootReveal } from "../hooks/useBootReveal";
import { useDeck } from "../hooks/useDeck";
import { captureHero } from "../hooks/useHeroFlight";
import {
  isPlainClick,
  LIVE,
  reduced,
  rollIdentity,
  usePageEnter,
  useTransitionNavigate
} from "../hooks/usePageTransition";
import { useLenis } from "../hooks/useLenis";
import { useTheme } from "../hooks/useTheme";
import { EASE, PAGE_S } from "../lib/motion";
import { projectBySlug, projects } from "../lib/projects";
import { site } from "../lib/site";

/* The left pane is one slot fed from three sources, the same way default.html
   fed it: the site on the home page, the project's own front matter on a
   project, a fixed pair on /resume.

   Derived from the path rather than plumbed down through route `handle`s. The
   route set is four entries and stable, and reading it here keeps the pane a
   plain function of the URL — no context, no double render, and nothing for a
   new route to forget to provide. */
interface Pane {
  title: string;
  sub: string | null;
  meta: string | null;
}

function paneFor(pathname: string): Pane {
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

/* The page that is leaving.
 *
 * A navigation here used to be strictly sequential — the outgoing page finished
 * animating away, and only then did the route change. The reference
 * (gabrielbeaugonin.com) overlaps them instead: the click navigates on the
 * spot, and the page that is leaving keeps existing, fading over the full page
 * duration underneath the one arriving. Nothing waits for anything, so there is
 * no seam between the two halves for the reader to notice.
 *
 * Keeping a route mounted past its own URL takes some care. `useOutlet` hands
 * back an element already bound to the route that matched, so re-rendering that
 * same element object renders that same route regardless of where the location
 * has since moved to — its own params come with it. The one thing that must not
 * happen is React deciding it is a *different* child and rebuilding it: the
 * DOM underneath carries a frame of deck transforms, an inline `visibility` put
 * there by the flight, and mounted effects that would tear down and re-run. So
 * the wrapper it lives in is keyed by pathname and never moves. On the render
 * that swaps routes, the key the outgoing page already had is still present —
 * it is simply wearing a different class now — and React updates that div in
 * place and leaves everything below it alone.
 *
 * It is pinned with `position: fixed` to the rectangle it occupied at the
 * moment of the click. That is not decoration either. Its own pane is about to
 * change padding and overflow underneath it (home and the inner pages do not
 * agree about either), and it is about to be scrolled back to the top for the
 * arriving route. A fixed box measured once is immune to both: it is a
 * photograph of where the page was, and photographs do not reflow. */
interface Frame {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PaneFrame extends Frame {
  padTop: number;
  padLeft: number;
  padRight: number;
  scrollTop: number;
}

interface Ghost {
  key: string;
  home: boolean;
  outlet: ReactNode;
  pane: Pane;
  right: PaneFrame | null;
  left: Frame | null;
}

function frameOf(el: Element | null): Frame | null {
  if (!el) return null;
  const box = el.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

function paneFrameOf(scroller: HTMLElement | null): PaneFrame | null {
  const frame = frameOf(scroller);
  if (!frame || !scroller) return null;
  const style = getComputedStyle(scroller);
  return {
    ...frame,
    padTop: parseFloat(style.paddingTop) || 0,
    padLeft: parseFloat(style.paddingLeft) || 0,
    padRight: parseFloat(style.paddingRight) || 0,
    scrollTop: scroller.scrollTop
  };
}

/* The box is grown upwards by however far the page was scrolled and then clipped
   back to the pane, which is the only way to put content that was scrolled out
   of view where it belongs without a wrapper to scroll it. */
function ghostStyle(frame: PaneFrame): CSSProperties {
  return {
    top: frame.top - frame.scrollTop,
    left: frame.left,
    width: frame.width,
    height: frame.height + frame.scrollTop,
    paddingTop: frame.padTop,
    paddingLeft: frame.padLeft,
    paddingRight: frame.padRight,
    clipPath: frame.scrollTop ? `inset(${frame.scrollTop}px 0 0 0)` : undefined
  };
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const isHome = pathname === "/";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const rightGhostRef = useRef<HTMLDivElement>(null);
  const leftGhostRef = useRef<HTMLDivElement>(null);
  const lenisRef = useLenis(scrollerRef);
  const { theme, toggle } = useTheme();
  const [active, setActive] = useState(0);

  const pane = paneFor(pathname);

  /* Captured during render, deliberately: this is the last moment at which the
     DOM still belongs to the page that is leaving. React has not committed the
     new tree yet, so every rectangle read here is the one the reader is
     actually looking at. An effect would be a frame too late. */
  const held = useRef({ key: pathname, outlet, pane, isHome });
  const [ghost, setGhost] = useState<Ghost | null>(null);

  if (held.current.key !== pathname) {
    const previous = held.current;
    held.current = { key: pathname, outlet, pane, isHome };
    if (!reduced()) {
      setGhost({
        key: previous.key,
        home: previous.isHome,
        outlet: previous.outlet,
        pane: previous.pane,
        right: paneFrameOf(scrollerRef.current),
        left: frameOf(document.querySelector(".identity:not(.is-ghost)"))
      });
    }
  }

  /* The page that is leaving does it in two different ways at once, because the
     two halves of it are leaving for different reasons. The pane is a picture of
     somewhere the reader no longer is, and it fades. The heading is a label on a
     slot that still exists and is about to say something else, so it rolls out
     of the box it lives in while the new one rolls in — see rollIdentity. */
  useEffect(() => {
    if (!ghost) return;
    const drop = () => setGhost((current) => (current === ghost ? null : current));

    const pane = rightGhostRef.current;
    const fade = pane
      ? animate(pane, { opacity: [1, 0] }, { duration: PAGE_S, ease: EASE })
      : null;
    const heading = rollIdentity(leftGhostRef.current, {
      from: ghost.home ? "above" : "below",
      out: true
    });
    heading.play();

    /* Both run for exactly PAGE_S, so one clock retires the copy. A timer
       rather than the fade's promise because there is not always a pane to
       fade — /resume leaving for home is a heading and nothing else. */
    const timer = setTimeout(drop, PAGE_S * 1000);
    return () => {
      clearTimeout(timer);
      fade?.stop();
      heading.stop();
    };
  }, [ghost]);

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
     and the observer catches prose growing afterwards as its images arrive.

     The observer watches the live page's own root rather than the pane's first
     element child, which during a transition is the copy that is leaving. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    const lenis = lenisRef.current;
    if (!scroller) return;

    if (!isHome) {
      scroller.scrollTop = 0;
      lenis?.scrollTo(0, { immediate: true, force: true });
    }
    lenis?.resize();

    const child = pageRef.current?.firstElementChild;
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
   * place in front of the reader on a cold load. */
  useBootReveal();
  usePageEnter();
  const go = useTransitionNavigate();

  const projectHero = () =>
    document.querySelector<HTMLElement>(
      `${LIVE} .project__media img, ${LIVE} .project__media video`
    );

  return (
    <div className="shell">
      <aside className="pane-left">
        {ghost?.left && (
          <div
            className="identity is-ghost"
            data-from={ghost.home ? "home" : "inner"}
            ref={leftGhostRef}
            inert
            style={{
              top: ghost.left.top,
              left: ghost.left.left,
              width: ghost.left.width
            }}
          >
            <div className="identity__mask">
              <h1 className="identity__title identity__roll">{ghost.pane.title}</h1>
            </div>
            {ghost.pane.sub && (
              <div className="identity__mask">
                <p className="identity__sub identity__roll">{ghost.pane.sub}</p>
              </div>
            )}
            {ghost.pane.meta && (
              <div className="identity__mask">
                <p className="identity__meta identity__roll">{ghost.pane.meta}</p>
              </div>
            )}
          </div>
        )}

        {/* Keyed, so a route change replaces this subtree outright rather than
            patching the text inside it. The arrival splits these lines into
            masked spans by hand, and React must never be asked to reconcile
            against DOM it did not write. */}
        <div className="identity" data-from={isHome ? "home" : "inner"} key={pathname}>
          <div className="identity__mask">
            <h1 className="identity__title identity__roll">{pane.title}</h1>
          </div>
          {pane.sub && (
            <div className="identity__mask">
              <p className="identity__sub identity__roll">{pane.sub}</p>
            </div>
          )}
          {pane.meta && (
            <div className="identity__mask">
              <p className="identity__meta identity__roll">{pane.meta}</p>
            </div>
          )}
        </div>

        {/* Sibling of .identity, not a child: on mobile .pane-left becomes
            display:contents so these two land at opposite ends of the grid. */}
        <nav className="icon-row" aria-label="Primary">
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

          {/* Set apart from the four beside it, because it is not the same kind
              of thing: those four leave the site, this one moves around inside
              it. A rule is enough to say so — it costs a pixel and saves the
              reader having to learn which icon is which. */}
          <span className="icon-row__rule" aria-hidden="true" />
          <Link
            className="icon-btn"
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
        </nav>
      </aside>

      <div className="pane-right" id="scroller" ref={scrollerRef}>
        {/* Both wrappers are `display: contents` while they are live, so the
            route's own root element is still a direct child of the pane as far
            as layout is concerned and nothing here changes what the deck or the
            prose are sized against. Only the copy that is leaving gets a box,
            and it gets one that is pinned to the viewport. */}
        {ghost?.right && (
          <div
            key={ghost.key}
            className="pane-page pane-ghost"
            ref={rightGhostRef}
            inert
            style={ghostStyle(ghost.right)}
          >
            {ghost.outlet}
          </div>
        )}
        <div className="pane-page" key={pathname} ref={pageRef}>
          {outlet}
        </div>
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
