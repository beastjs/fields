import { compile } from 'tailwindcss';
import { tailwindStylesheets } from '../generated/tailwind';
import { normalizePath } from './virtual-fs';

// Kept dependency-free so the main bundle can check stylesheets without loading the compiler.
export { usesTailwind } from './tailwind-import';

const SCANNED_SOURCE = /\.(btsx|tsrx|ts|js|json)$/;

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

const directory = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';

/**
 * Compiles the stylesheet at `file`. Tailwind inlines every `@import` it does not skip (URLs), so
 * bundled `tailwindcss` sheets and project `.css` files, relative to the importing sheet, both resolve.
 */
export async function compileTailwind(css: string, candidates: string[], file: string, read: (path: string) => string | undefined) {
  const loadStylesheet = async (id: string, base: string) => {
    const bundled = tailwindStylesheets[id];
    if (bundled !== undefined) return { path: id, base, content: bundled };
    if (!id.startsWith('.') && !id.startsWith('/')) {
      throw new Error(`Cannot resolve stylesheet "${id}". Only "tailwindcss" and project .css imports are supported.`);
    }
    const path = normalizePath(id.startsWith('/') ? id : `${base}/${id}`);
    const content = path.endsWith('.css') ? read(path) : undefined;
    if (content === undefined) throw new Error(`Cannot resolve stylesheet "${id}": ${path} is not a .css file in this project.`);
    return { path, base: directory(path), content };
  };
  const compiler = await compile(css, { base: directory(file), loadStylesheet });
  return compiler.build(candidates);
}
