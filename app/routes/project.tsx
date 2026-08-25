import { useRef } from "react";
import { useParams } from "react-router";
import { useHeroLandingRef } from "../hooks/useHeroFlight";
import { projectBySlug } from "../lib/projects";
import { seo } from "../lib/seo";
import type { Route } from "./+types/project";

export function meta({ params }: Route.MetaArgs) {
  const project = projectBySlug(params.slug);
  if (!project) return seo({ path: `/projects/${params.slug}` });
  return seo({
    title: project.title,
    description: project.description,
    path: `/projects/${project.slug}`,
    project: {}
  });
}

export default function ProjectPage() {
  const { slug } = useParams();
  const project = projectBySlug(slug);
  const heroRef = useRef<HTMLElement>(null);

  useHeroLandingRef(heroRef, slug ?? "");

  if (!project) {
    return (
      <div className="prose">
        <h2>Not found</h2>
        <p>No project by that name.</p>
      </div>
    );
  }

  const { hero_video: video, image } = project;

  return (
    /* No <h1> here: the project title is the left pane's heading. */
    <article className="project">
      {video ? (
        <figure className="project__media">
          <video
            ref={heroRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={video.poster}
          >
            <source src={video.path} type={video.type ?? "video/mp4"} />
          </video>
          {video.caption && <figcaption>{video.caption}</figcaption>}
        </figure>
      ) : image ? (
        <figure className="project__media">
          <img
            ref={heroRef as React.RefObject<HTMLImageElement>}
            src={image.path}
            alt={image.alt ?? project.title}
          />
        </figure>
      ) : null}

      {/* Rendered to HTML at build time by the markdown plugin. The posts carry
          hand-authored inline SVG that only survives being passed through
          untouched — see plugins/markdown.js. */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: project.html }} />
    </article>
  );
}
