import { compile } from 'tailwindcss';
import { tailwindStylesheets } from '../generated/tailwind';

const TAILWIND_IMPORT = /@import\s+(?:url\(\s*)?["']tailwindcss(?:\/[\w.-]+)?["']/;
const SCANNED_SOURCE = /\.(btsx|tsrx|ts|js|json)$/;

/** Only stylesheets that opt in with `@import "tailwindcss"` (or a subpath) are compiled by Tailwind. */
export function usesTailwind(css: string) {
  return TAILWIND_IMPORT.test(css);
}

/**
 * A permissive stand-in for Tailwind's native scanner. Tailwind ignores tokens that are not
 * utilities, so over-collecting is safe; BTSX selector shorthand (`div.flex.gap-2`) and
 * `class='…'` attributes both produce candidates.
 */
export function extractCandidates(files: Record<string, string>) {
  const candidates = new Set<string>();
  for (const [path, source] of Object.entries(files)) {
    if (!SCANNED_SOURCE.test(path)) continue;
    for (const token of source.split(/[\s"'`]+/)) {
      if (!token || token.length > 200) continue;
      candidates.add(token);
      for (const part of token.split(/[.(){}=,;<>#]+/)) if (part) candidates.add(part);
    }
  }
  return [...candidates];
}

async function loadStylesheet(id: string, base: string) {
  const content = tailwindStylesheets[id];
  if (content === undefined) throw new Error(`Cannot resolve stylesheet "${id}". Only "tailwindcss" imports are supported.`);
  return { path: id, base, content };
}

export async function compileTailwind(css: string, candidates: string[]) {
  const compiler = await compile(css, { base: '/', loadStylesheet });
  return compiler.build(candidates);
}
