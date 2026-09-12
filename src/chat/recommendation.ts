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

/** Applies SEARCH/REPLACE hunks in order; every search must match exactly once. */
function applyHunks(original: string, body: string): HunkResult {
  const hunks = parseHunks(body);
  if (!hunks.length) return { error: 'That patch block has no SEARCH/REPLACE hunks, so there is nothing to apply. Ask again for a patch with SEARCH and REPLACE sections.' };
  let source = original;
  for (const { search, replace } of hunks) {
    if (!search) return { error: 'A hunk has an empty SEARCH section. Anchor insertions on a nearby line.' };
    const at = source.indexOf(search);
    if (at < 0) return { error: 'A hunk does not match the current file. Ask for a fresh recommendation.' };
    if (source.indexOf(search, at + 1) >= 0) return { error: 'A hunk matches more than once. It needs more surrounding context.' };
    source = source.slice(0, at) + replace + source.slice(at + search.length);
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
