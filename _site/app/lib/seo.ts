import { site, socialLinks } from "./site";

/* A port of _includes/seo.html. The tags and the JSON-LD graph are the ones the
   site already publishes; only the templating language changed. */

const PERSON_ID = `${site.url}/#person`;
const WEBSITE_ID = `${site.url}/#website`;

export interface SeoInput {
  title?: string;
  description?: string;
  path: string;
  /* A project page publishes a CreativeWork alongside the Person and WebSite;
     everything else publishes a WebPage. */
  project?: { created?: string };
}

export function seo({ title, description, path, project }: SeoInput) {
  const seoTitle = title && title !== "Home" ? `${title} | ${site.title}` : site.title;
  const desc = (description ?? site.description).replace(/\s+/g, " ").trim();
  const canonical = `${site.url}${path.endsWith("/") ? path : `${path}/`}`;

  const person = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: site.author.name,
    url: site.url,
    email: `mailto:${site.author.email}`,
    affiliation: {
      "@type": "CollegeOrUniversity",
      name: site.author.affiliation
    },
    sameAs: socialLinks,
    knowsAbout: site.keywords
  };

  const website = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: site.title,
    url: site.url,
    description: site.description,
    publisher: { "@id": PERSON_ID }
  };

  const leaf = project
    ? {
        "@type": "CreativeWork",
        "@id": `${canonical}#project`,
        name: title,
        headline: title,
        description: desc,
        url: canonical,
        ...(project.created ? { dateCreated: project.created } : {}),
        author: { "@id": PERSON_ID }
      }
    : {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        name: seoTitle,
        description: desc,
        url: canonical,
        isPartOf: { "@id": WEBSITE_ID }
      };

  return [
    { title: seoTitle },
    { name: "description", content: desc },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:site_name", content: site.title },
    { property: "og:title", content: seoTitle },
    { property: "og:description", content: desc },
    { property: "og:url", content: canonical },
    { property: "og:type", content: project ? "article" : "website" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: seoTitle },
    { name: "twitter:description", content: desc },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": [person, website, leaf]
      }
    }
  ];
}
