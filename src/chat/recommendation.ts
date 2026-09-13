import type { FileContext } from './contracts';

export interface FileRecommendation { file: string; source?: string; hunks?: number; error?: string }

// The language tag and quoting around the path vary between models; the file=/patch= marker
// is what makes a block actionable, so only that part is required.
const marker = '^`{3,}[a-z]*[ \\t]*MARKER=[\'"]?(/[^\\s\'"`]+)[\'"]?[ \\t]*\\r?\\n';
const fullBlock = new RegExp(marker.replace('MARKER', 'file') + '([\\s\\S]*?)^`{3,}[ \\t]*\\r?$', 'gm');
const patchBlock = new RegExp(marker.replace('MARKER', 'patch') + '([\\s\\S]*?)^`{3,}[ \\t]*\\r?$', 'gm');
const unterminated = new RegExp(marker.replace('MARKER', '(?:file|patch)'), 'm');
const hunkPattern = /^<{3,}[ \t]*SEARCH[ \t]*\r?\n([\s\S]*?)^={3,}[ \t]*\r?\n([\s\S]*?)^>{3,}[ \t]*REPLACE[ \t]*\r?$/gm;

const plainBlock = new RegExp('^`{3,}[a-z]*[ \\t]*\\r?\\n([\\s\\S]*?)^`{3,}[ \\t]*\\r?$', 'gm');
const openHunk = /^<{3,}[ \t]*SEARCH/m;

/** Hunks as parsed pairs, shared by the applier and the diff renderer. */
export function parseHunks(body: string) {
  return [...body.matchAll(hunkPattern)].map(([, search, replace]) => ({ search, replace }));
}

/** Models often open a fence mid-sentence; markdown needs it on its own line. */
const normalize = (content: string) => content.replace(/([^\n])(`{3,}[a-z]*[ \t]*(?:file|patch)=)/g, '$1\n$2');

type HunkResult = { source: string; hunks: number; error?: undefined } | { source?: undefined; error: string };

interface HunkMatch { at: number; length: number }

const occurrenceMatches = (source: string, search: string) => {
  const matches: HunkMatch[] = [];
  let cursor = 0;
  while (cursor <= source.length - search.length) {
    const at = source.indexOf(search, cursor);
    if (at < 0) break;
    matches.push({ at, length: search.length });
    cursor = at + 1;
  }
  return matches;
};

/**
 * Find one safe target for a model-authored SEARCH block. Exact matches remain
 * preferred. The fallback only normalizes line-ending details that models
 * commonly lose: CRLF, trailing horizontal whitespace, and a final newline at
 * EOF. It never guesses between multiple possible locations.
 */
function findHunkMatches(source: string, search: string): HunkMatch[] {
  const exact = occurrenceMatches(source, search);
  if (exact.length) return exact;

  const searchHasFinalNewline = search.endsWith('\n');
  const searchBody = searchHasFinalNewline ? search.slice(0, -1) : search;
  const wanted = searchBody.split('\n').map(line => line.trimEnd());
  const sourceLines: { start: number; contentEnd: number; end: number; text: string }[] = [];
  let start = 0;
  while (start < source.length) {
    const newline = source.indexOf('\n', start);
    const contentEnd = newline < 0 ? source.length : newline;
    const end = newline < 0 ? source.length : newline + 1;
    sourceLines.push({ start, contentEnd, end, text: source.slice(start, contentEnd).trimEnd() });
    start = end;
  }

  const matches: HunkMatch[] = [];
  for (let line = 0; line + wanted.length <= sourceLines.length; line += 1) {
    if (!wanted.every((text, index) => sourceLines[line + index].text === text)) continue;
    const first = sourceLines[line];
    const last = sourceLines[line + wanted.length - 1];
    const end = searchHasFinalNewline ? last.end : last.contentEnd;
    matches.push({ at: first.start, length: end - first.start });
  }
  return matches;
}

/** Applies SEARCH/REPLACE hunks in order; every search must resolve to exactly one safe location. */
function applyHunks(original: string, body: string): HunkResult {
  const hunks = parseHunks(body);
  if (!hunks.length) return { error: 'That patch block has no SEARCH/REPLACE hunks, so there is nothing to apply. Ask again for a patch with SEARCH and REPLACE sections.' };
  let source = original.replace(/\r\n/g, '\n');
  for (const { search, replace } of hunks) {
    if (!search) return { error: 'A hunk has an empty SEARCH section. Anchor insertions on a nearby line.' };
    const matches = findHunkMatches(source, search);
    if (!matches.length) return { error: 'A hunk does not match the current file closely enough to apply safely. Ask for a fresh recommendation.' };
    if (matches.length > 1) return { error: 'A hunk matches more than once. It needs more surrounding context.' };
    const { at, length } = matches[0];
    source = source.slice(0, at) + replace + source.slice(at + length);
  }
  return { source, hunks: hunks.length };
}

/** Only explicit complete-file or patch blocks are actionable; ordinary snippets stay illustrative. */
export function fileRecommendation(raw: string, context?: FileContext): FileRecommendation | undefined {
  if (!context) return;
  const content = normalize(raw);
  const full = [...content.matchAll(fullBlock)];
  const patches = [...content.matchAll(patchBlock)];
  // A block of SEARCH/REPLACE hunks is a patch for the attached file even when the model
  // forgets the patch= marker: the hunks still have to match that file exactly to apply.
  const bare = full.length + patches.length ? [] : [...content.matchAll(plainBlock)].filter(block => parseHunks(block[1]).length);
  if (full.length + patches.length + bare.length !== 1) {
    if (full.length + patches.length + bare.length) return;
    // An opened but unclosed block means the reply stopped before the code finished.
    const opened = unterminated.exec(content);
    if (opened ? opened[1] === context.file : openHunk.test(content)) {
      return { file: context.file, error: 'The response was cut off before its code block finished. Ask for a smaller change, or for a patch instead of a full file.' };
    }
    return;
  }
  const file = full[0]?.[1] ?? patches[0]?.[1] ?? context.file;
  const body = full[0]?.[2] ?? patches[0]?.[2] ?? bare[0][1];
  if (file !== context.file) return;
  if (full.length) {
    const source = body.replace(/\r\n/g, '\n');
    if (source.length > 60000 || source === context.source) return;
    return { file, source };
  }
  const applied = applyHunks(context.source, body.replace(/\r\n/g, '\n'));
  if (applied.source === undefined) return { file, error: applied.error };
  if (applied.source.length > 60000 || applied.source === context.source) return;
  return { file, source: applied.source, hunks: applied.hunks };
}
