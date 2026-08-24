import { ResumeIcon } from "../components/Icons";
import { seo } from "../lib/seo";
import type { Route } from "./+types/resume";

const PDF = "/assets/img/RESUME.pdf";

export function meta(_: Route.MetaArgs) {
  return seo({
    title: "Resume",
    description: "Current resume as a PDF.",
    path: "/resume"
  });
}

export default function Resume() {
  return (
    <div className="prose">
      <p>
        {/* Hands off to the browser's own viewer, so it stays a plain anchor
            rather than a client-side navigation. */}
        <a className="inline-action" href={PDF}>
          <ResumeIcon />
          <span>Open PDF</span>
        </a>
      </p>
      <iframe className="pdf-frame" src={PDF} title="Resume PDF" />
    </div>
  );
}
