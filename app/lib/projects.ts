export interface Media {
  path: string;
  alt?: string;
  position?: string;
}

export interface HeroVideo {
  path: string;
  poster?: string;
  type?: string;
  caption?: string;
}

export interface ProjectMeta {
  title: string;
  description: string;
  years: string;
  slug: string;
  tile_order: number;
  display?: boolean;
  image?: Media;
  preview_image?: Media;
  hero_video?: HeroVideo;
}

export interface Project extends ProjectMeta {
  html: string;
}

/* Eager on purpose. The twelve bodies come to well under 100KB of markdown, and
   loading them together buys a project page that renders from a synchronous
   import — no loader, no pending state, no await between the click and the
   prose. Worth revisiting if this ever becomes fifty projects. */
const modules = import.meta.glob<{ frontmatter: ProjectMeta; html: string }>(
  "/content/projects/*.md",
  { eager: true }
);

export const projects: Project[] = Object.values(modules)
  .map((m) => ({ ...m.frontmatter, html: m.html }))
  .filter((p) => p.display !== false)
  .sort((a, b) => a.tile_order - b.tile_order);

const bySlug = new Map(projects.map((p) => [p.slug, p]));

export function projectBySlug(slug: string | undefined): Project | undefined {
  return slug ? bySlug.get(slug) : undefined;
}

/* The card's preview and the project's hero are not always the same file — two
   projects deliberately differ — so both are named separately. */
export function previewOf(p: Project): Media | undefined {
  return p.preview_image ?? p.image;
}

export function heroPosterOf(p: Project): string | undefined {
  return p.hero_video?.poster ?? p.image?.path;
}
