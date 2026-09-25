import { lineChanges } from './line-changes';
import { locateEditLines } from './edit-locations';
import type { FileContext } from './contracts';
import { normalizeFences } from './fences';

export interface FileRecommendation { file: string; source?: string; hunks?: number; error?: string }

// The language tag and quoting around the path vary between models; the file=/patch= marker
// is what makes a block actionable, so only that part is required.
const marker = '^`{3,}[\\w+-]*[ \\t]*MARKER=[\'"]?((?:\\./|/)?[^\\s\'"`]+)[\'"]?[ \\t]*\\r?\\n';
const fullBlock = new RegExp(marker.replace('MARKER', 'file') + '([\\s\\S]*?)^`{3,}[ \\t]*\\r?$', 'gm');
const patchBlock = new RegExp(marker.replace('MARKER', 'patch') + '([\\s\\S]*?)^`{3,}[ \\t]*\\r?$', 'gm');
const unterminated = new RegExp(marker.replace('MARKER', '(?:file|patch)'), 'm');
const hunkPattern = /^<{3,}[ \t]*SEARCH[ \t]*\r?\n([\s\S]*?)^={3,}[ \t]*\r?\n([\s\S]*?)^>{3,}[ \t]*REPLACE[ \t]*\r?$/gm;

const plainBlock = new RegExp('^`{3,}[^\\n`]*\\r?\\n([\\s\\S]*?)^`{3,}[ \\t]*\\r?$', 'gm');
const openHunk = /^<{3,}[ \t]*SEARCH/m;

/** Hunks as parsed pairs, shared by the applier and the diff renderer. */
export function parseHunks(body: string) {
  return [...body.matchAll(hunkPattern)].map(([, search, replace]) => ({ search, replace }));
}


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
  let source = original;
  for (const { search, replace } of hunks) {
    if (!search) return { error: 'A hunk has an empty SEARCH section. Anchor insertions on a nearby line.' };
    const matches = findHunkMatches(source, search);
    if (!matches.length) {
      const candidates = locateEditLines(source, search, 3);
      return { error: 'A hunk does not match the current file closely enough to apply safely. Its SEARCH text is absent from the attached source.' +
        (candidates.length ? ` Check current source near lines ${candidates.map(candidate => candidate.line).join(', ')} and copy the intended line exactly.` : ' Locate the requested text in the current source before retrying.') };
    }
    if (matches.length > 1) return { error: 'A hunk matches more than once. It needs more surrounding context.' };
    const { at, length } = matches[0];
    const matchedLines = source.slice(at, at + length).match(/[^\n]*\n|[^\n]+$/g) ?? [];
    let line = 0;
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    const changes = lineChanges(search, replace);
    const replacement = changes.map((change, index) => {
      if (change.kind === 'same') {
        const preserved = matchedLines[line++] ?? change.text;
        // An EOF anchor without a newline needs a separator when inserting lines after it.
        return !preserved.endsWith('\n') && change.text.endsWith('\n') && changes.slice(index + 1).some(next => next.kind !== 'del')
          ? preserved + newline : preserved;
      }
      if (change.kind === 'del') { line++; return ''; }
      return change.text.replace(/\n/g, newline);
    }).join('');
    source = source.slice(0, at) + replacement + source.slice(at + length);
  }
  return { source, hunks: hunks.length };
}

/** Models write the attached path as /src/App.btsx, src/App.btsx or ./src/App.btsx. */
const projectPath = (path: string) => '/' + path.replace(/^\.?\/+/, '');

/**
 * Only explicit complete-file or patch blocks, or bare blocks of hunks, are actionable; ordinary
 * snippets stay illustrative. Anything that renders as a change (a marked block or hunks) returns
 * a result: either the new source or an error explaining why it cannot apply, never silence.
 */
export function fileRecommendation(raw: string, context?: FileContext, references: readonly FileContext[] = []): FileRecommendation | undefined {
  const content = normalizeFences(raw);
  const full = [...content.matchAll(fullBlock)];
  const patches = [...content.matchAll(patchBlock)];
  // A block of SEARCH/REPLACE hunks is a patch for the attached file even when the model
  // forgets the patch= marker: the hunks still have to match that file exactly to apply.
  const bare = full.length + patches.length ? [] : [...content.matchAll(plainBlock)].filter(block => parseHunks(block[1]).length);
  if (!full.length && !patches.length && !bare.length) {
    // An opened but unclosed block means the reply stopped before the code finished.
    const opened = unterminated.exec(content);
    if (opened || openHunk.test(content)) {
      return { file: opened ? projectPath(opened[1]) : context?.file ?? 'attached file', error: 'The response was cut off before its code block finished. Ask for a smaller change, or for a patch instead of a full file.' };
    }
    return;
  }
  const targets = [...full, ...patches].map(block => projectPath(block[1]));
  if (new Set(targets).size > 1) {
    return { file: targets[0], error: 'The reply targets more than one file. Ask for a single-file patch so it can be verified safely.' };
  }
  // Explicit paths may select any supplied source. Bare hunks still belong only to the active file.
  if (targets.length && targets[0] !== context?.file) {
    context = references.find(reference => reference.file === targets[0]) ?? context;
  }
  if (!context) {
    return { file: targets[0] ?? 'attached file', error: 'No file was attached to this message, so there is nothing to apply it to. Turn on active-file context and ask again.' };
  }
  const other = targets.find(target => target !== context.file);
  if (other) return { file: other, error: `This change targets ${other}, but the attached file is ${context.file}. Open that file and ask again.` };
  const file = context.file;
  if (full.length > 1 || (full.length && patches.length)) {
    return { file, error: 'The reply has more than one change block for this file. Ask for a single patch.' };
  }
  if (full.length) {
    const source = full[0][2].replace(/\r\n/g, '\n');
    if (source.length > 60000) return { file, error: 'The rewritten file is over 60,000 characters and cannot be applied.' };
    if (source === context.source.replace(/\r\n/g, '\n')) return { file, error: 'This change is already in the file.' };
    return { file, source };
  }
  // Several patch (or bare hunk) blocks for the same file apply in order, like one block.
  const body = (patches.length ? patches.map(block => block[2]) : bare.map(block => block[1])).join('\n');
  const applied = applyHunks(context.source, body.replace(/\r\n/g, '\n'));
  if (applied.source === undefined) return { file, error: applied.error };
  if (applied.source.length > 60000) return { file, error: 'The patched file is over 60,000 characters and cannot be applied.' };
  if (applied.source === context.source) return { file, error: 'This change is already in the file.' };
  return { file, source: applied.source, hunks: applied.hunks };
}
