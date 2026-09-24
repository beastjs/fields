/**
 * The stylesheet every new project starts with, as `/src/style.css`.
 *
 * The tokens, the `@theme inline` mapping and the base layer are copied from `src/styles/theme.css`, so a project
 * starts on the same design tokens as the playground and can use `bg-background`, `text-muted-foreground`,
 * `rounded-lg`, `shadow-sm` and the rest from its first line. Two things differ, both because the preview is not the
 * playground:
 *
 * - Dark mode keys on `data-theme="dark"`, which is what the preview stamps on its `<html>` when the playground is
 *   dark, as well as on the `.dark` class `theme.css` uses. Keyed on the class alone, a preview would stay light.
 * - `html` takes the background too. The preview document paints its own ground behind the page, and a short page
 *   would otherwise show a band of it below the content.
 *
 * Below the copy are the starter page's own classes, rebuilt on the tokens so they follow the theme with it.
 */
export const STARTER_STYLES = `/* Tailwind utilities are available as classes: div.flex.gap-4 or div(class='p-4 text-sm'). */
/* The design tokens below come from the playground's own theme; change them to restyle the whole project. */
@import 'tailwindcss';

@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *, .dark, .dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.81 0.1 252);
  --chart-2: oklch(0.62 0.19 260);
  --chart-3: oklch(0.55 0.22 263);
  --chart-4: oklch(0.49 0.22 264);
  --chart-5: oklch(0.42 0.18 266);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.98 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.95 0 0);
  --sidebar-ring: oklch(0.708 0 0);
  --font-sans:
    ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
  --font-serif: ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  --radius: 0.625rem;
  --shadow-x: 0;
  --shadow-y: 1px;
  --shadow-blur: 3px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.1;
  --shadow-color: oklch(0 0 0);
  --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow-md: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 2px 4px -1px hsl(0 0% 0% / 0.1);
  --shadow-lg: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 4px 6px -1px hsl(0 0% 0% / 0.1);
  --shadow-xl: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 8px 10px -1px hsl(0 0% 0% / 0.1);
  --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

:root[data-theme='dark'],
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.269 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.371 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.275 0 0);
  --input: oklch(0.325 0 0);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.81 0.1 252);
  --chart-2: oklch(0.62 0.19 260);
  --chart-3: oklch(0.55 0.22 263);
  --chart-4: oklch(0.49 0.22 264);
  --chart-5: oklch(0.42 0.18 266);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.275 0 0);
  --sidebar-ring: oklch(0.439 0 0);
  --font-sans:
    ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
  --font-serif: ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  --radius: 0.625rem;
  --shadow-x: 0;
  --shadow-y: 1px;
  --shadow-blur: 3px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.1;
  --shadow-color: oklch(0 0 0);
  --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow-md: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 2px 4px -1px hsl(0 0% 0% / 0.1);
  --shadow-lg: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 4px 6px -1px hsl(0 0% 0% / 0.1);
  --shadow-xl: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 8px 10px -1px hsl(0 0% 0% / 0.1);
  --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html,
  body {
    @apply bg-background text-foreground;
  }
}

/* The starter page. Layered as components, so a utility on the same element still wins. */
@layer components {
  .page { max-width: 620px; margin: 0 auto; padding: 80px 40px; }
  .eyebrow { color: var(--muted-foreground); font-size: 10px; letter-spacing: .16em; font-weight: 650; }
  h1 { margin: 25px 0 14px; font-size: clamp(36px, 7vw, 52px); font-weight: 500; letter-spacing: -.06em; }
  .intro { margin: 0 0 10px; font-size: 17px; }
  .description { font-size: 13px; line-height: 1.8; color: var(--muted-foreground); }
  .counter { margin-top: 38px; padding: 24px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); color: var(--card-foreground); box-shadow: var(--shadow-sm); }
  .caption { font-size: 9px; letter-spacing: .14em; color: var(--muted-foreground); }
  .counter-row { display: flex; align-items: center; gap: 28px; margin: 24px 0; }
  .step { width: 38px; height: 38px; border: 1px solid var(--border); border-radius: 50%; background: var(--secondary); color: var(--secondary-foreground); box-shadow: var(--shadow-xs); font-size: 22px; cursor: pointer; }
  .step:hover { background: var(--accent); color: var(--accent-foreground); }
  .value { min-width: 30px; font-size: 38px; font-family: var(--font-mono); font-weight: 400; text-align: center; }
  .counter-note { font-size: 11px; color: var(--muted-foreground); margin: 0; }
  footer { margin-top: 44px; font-size: 10px; color: var(--muted-foreground); }
}
`
