import { parseHunks } from './recommendation';

const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (value: string) => value.replace(/[&<>"]/g, character => escapes[character]);
const lines = (block: string) => (block ? block.replace(/\n$/, '').split('\n') : []);
const row = (kind: string, gutter: number | undefined, text: string) =>
  `<span class="diff-row diff-${kind}"><span class="diff-num">${gutter ?? ''}</span><span class="diff-text">${escape(text)}</span></span>`;

/**
 * Renders SEARCH/REPLACE hunks as a diff instead of raw conflict markers, numbering rows
 * against `original` when it is attached. Returns undefined for blocks that hold no hunks.
 */
export function diffBlock(code: string, original?: string) {
  const hunks = parseHunks(code);
  if (!hunks.length) return;
  const body: string[] = [];
  // Hunks apply top to bottom, so searching forward from the last match keeps numbering right
  // when the same text appears more than once. Added rows are numbered in the resulting file.
  let cursor = 0, shift = 0;
  for (const { search, replace } of hunks) {
    const at = original ? original.indexOf(search, cursor) : -1;
    let line: number | undefined;
    if (at >= 0) { line = original!.slice(0, at).split('\n').length; cursor = at + search.length; }
    const removed = lines(search), added = lines(replace);
    if (body.length) body.push(row('gap', undefined, '⋯'));
    removed.forEach((text, index) => body.push(row('del', line && line + index, '- ' + text)));
    added.forEach((text, index) => body.push(row('add', line && line + shift + index, '+ ' + text)));
    shift += added.length - removed.length;
  }
  // The rows are block elements: a joining newline would render as a second blank line.
  return `<pre class="chat-diff"><code>${body.join('')}</code></pre>`;
}
