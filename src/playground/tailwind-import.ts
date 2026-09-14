const TAILWIND_IMPORT = /@import\s+(?:url\(\s*)?["']tailwindcss(?:\/[\w.-]+)?["']/;

/** Only stylesheets that opt in with `@import "tailwindcss"` (or a subpath) are compiled by Tailwind. */
export function usesTailwind(css: string) {
  return TAILWIND_IMPORT.test(css);
}
