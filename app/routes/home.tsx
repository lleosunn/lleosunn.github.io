import { useRef } from "react";
import { Link } from "react-router";
import { captureHero, useHeroLanding } from "../hooks/useHeroFlight";
import { focusedTileImage, storeIndex } from "../hooks/useDeck";
import { heroPosterOf, previewOf, projects } from "../lib/projects";
import { seo } from "../lib/seo";
import type { Route } from "./+types/home";

const COPIES = 3;

export function meta(_: Route.MetaArgs) {
  return seo({ path: "/" });
}

export default function Home() {
  const ref = useRef<HTMLDivElement>(null);

  /* Coming back from a project, the flight lands on whichever card the wheel
     has left in focus — which only the deck can say, since the loop may have
     left it in any of the three copies. */
  useHeroLanding(() => focusedTileImage(), "home");

  return (
    /* The list is emitted three times so the deck can loop: the wheel starts in
       the middle copy and, once a scroll settles more than half a list from it,
       jumps by exactly one list length. That jump lands at the same offset
       within an identical run of cards, so it is invisible wherever it happens.

       Only the middle copy is real to assistive tech and to the keyboard; the
       outer two are scenery. */
    <div className="tiles" data-copies={COPIES} ref={ref}>
      {Array.from({ length: COPIES }, (_, copy) =>
        projects.map((project, index) => {
          const preview = previewOf(project);
          const real = copy === 1;
          return (
            <div
              className="tile"
              data-index={index}
              key={`${copy}-${project.slug}`}
              aria-hidden={real ? undefined : true}
            >
              <Link
                className="tile__card"
                to={`/projects/${project.slug}`}
                data-hero={heroPosterOf(project)}
                tabIndex={real ? undefined : -1}
                onClick={(event) => {
                  storeIndex(index);
                  captureHero(event.currentTarget.querySelector(".tile__image"));
                }}
              >
                {preview && (
                  <img
                    className="tile__image"
                    src={preview.path}
                    alt={preview.alt ?? project.title}
                    style={preview.position ? { objectPosition: preview.position } : undefined}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span className="tile__name">{project.title}</span>
              </Link>
            </div>
          );
        })
      )}
    </div>
  );
}
