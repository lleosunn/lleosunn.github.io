import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

/* The resolved theme already sits on <html> before React runs — the inline
   script in root.tsx puts it there to avoid a flash. This only mirrors it into
   state so the toggle button can label itself, and writes both back on click. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "dark" || current === "light") setTheme(current);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* Private mode. The choice just does not persist. */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
