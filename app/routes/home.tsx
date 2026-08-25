import { Link } from "react-router";
import { captureHero, useHeroLanding } from "../hooks/useHeroFlight";
import { isPlainClick, useTransitionNavigate } from "../hooks/usePageTransition";
import { focusedTileImage, storeIndex } from "../hooks/useDeck";
import { heroPosterOf, previewOf, projects } from "../lib/projects";
import { seo } from "../lib/seo";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return seo({ path: "/" });
}

export default function Home() {
  const go = useTransitionNavigate();

  /* Coming back from a project, the flight lands on whichever card the wheel
     has left in focus. */
  useHeroLanding(() => focusedTileImage(), "home");

  return (
    /* One tile per project, and that is the whole list.

       The deck used to emit this three times so it could loop: the wheel
       started in the middle copy and jumped a whole list length whenever a
       scroll settled too far from it, landing at the same offset in an
       identical run of cards so the jump could not be seen. That trick was in
       service of a real scroll container, which can only run between two ends.

       The position is a float now and the ring is closed by wrapping it, so
       there is nothing to jump across and no scenery to keep out of the
       keyboard's way — every project link below is real, focusable, and
       present exactly once. */
    <div className="tiles">
      {projects.map((project, index) => {
        const preview = previewOf(project);
        return (
          <div className="tile" data-index={index} key={project.slug}>
            <Link
              className="tile__card"
              to={`/projects/${project.slug}`}
              data-hero={heroPosterOf(project)}
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                /* Read before the exit starts: captureHero measures where the
                   card is on screen, and a moment later it will be mid-fade. */
                const image = event.currentTarget.querySelector(".tile__image");
                go(
                  `/projects/${project.slug}`,
                  () => {
                    storeIndex(index);
                    captureHero(image);
                  },
                  /* Raced against the exit. The flight lands on this file, and
                     landing on one that has not decoded is the single blink the
                     flight itself cannot cover. */
                  heroPosterOf(project)
                );
              }}
            >
              {preview && (
                <img
                  className="tile__image"
                  src={preview.path}
                  alt={preview.alt ?? project.title}
                  style={preview.position ? { objectPosition: preview.position } : undefined}
                  decoding="async"
                />
              )}
              <span className="tile__name">{project.title}</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
