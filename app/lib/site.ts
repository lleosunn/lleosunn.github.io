/* The handful of values that used to live in _config.yml and were reachable
   from any template as `site.*`. */
export const site = {
  title: "Leo Sun",
  tagline: "MIT Class of 2028",
  description:
    "Leo Sun is an MIT Class of 2028 student building robotics, autonomy, and AI systems.",
  url: "https://www.leosun.org",
  lang: "en",
  author: {
    name: "Leo Sun",
    email: "leosun@mit.edu",
    affiliation: "Massachusetts Institute of Technology"
  },
  github: "lleosunn",
  linkedin: "lleosunn",
  keywords: [
    "Leo Sun",
    "MIT",
    "Massachusetts Institute of Technology",
    "robotics",
    "autonomy",
    "artificial intelligence",
    "machine learning",
    "self-driving cars",
    "robot learning",
    "portfolio"
  ]
} as const;

export const socialLinks = [
  `https://github.com/${site.github}`,
  `https://www.linkedin.com/in/${site.linkedin}/`
];
