import { RangeSetBuilder, type EditorState, type Text } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { getIndentUnit } from '@codemirror/language';

// How far a blank line or the active block may look for its bounds; keeps huge files cheap.
const SCAN_LIMIT = 400;

/** Leading-whitespace column of a line, or -1 for a blank line. */
function column(doc: Text, number: number, tabSize: number) {
  const text = doc.line(number).text;
  let col = 0;
  for (const char of text) {
    if (char === ' ') col++;
    else if (char === '\t') col += tabSize - (col % tabSize);
    else return col;
  }
  return -1;
}

/** Blank lines take the shallower of their nearest non-blank neighbours, so guides run through gaps. */
function effectiveColumn(doc: Text, number: number, tabSize: number) {
  const own = column(doc, number, tabSize);
  if (own >= 0) return own;
  let above = 0, below = 0;
  for (let n = number - 1; n >= Math.max(1, number - SCAN_LIMIT); n--) { const c = column(doc, n, tabSize); if (c >= 0) { above = c; break; } }
  for (let n = number + 1; n <= Math.min(doc.lines, number + SCAN_LIMIT); n++) { const c = column(doc, n, tabSize); if (c >= 0) { below = c; break; } }
  return Math.min(above, below);
}

/**
 * The guide for the block holding the cursor: the cursor line's children when it opens a block,
 * otherwise the block the cursor line belongs to. Returns the guide column and its line span.
 */
export function activeIndentGuide(state: EditorState) {
  const { doc, tabSize } = state;
  const unit = getIndentUnit(state);
  const cursor = doc.lineAt(state.selection.main.head).number;
  const indent = effectiveColumn(doc, cursor, tabSize);
  let next = -1;
  for (let n = cursor + 1; n <= Math.min(doc.lines, cursor + SCAN_LIMIT) && next < 0; n++) next = column(doc, n, tabSize);
  const col = next > indent ? indent : indent - unit;
  if (col < 0) return;
  const inside = (n: number) => effectiveColumn(doc, n, tabSize) > col;
  let from = cursor, to = cursor;
  while (from > 1 && cursor - from < SCAN_LIMIT && inside(from - 1)) from--;
  while (to < doc.lines && to - cursor < SCAN_LIMIT && inside(to + 1)) to++;
  if (!inside(from)) from++;
  return from <= to ? { column: col, from, to } : undefined;
}

function build(view: EditorView): DecorationSet {
  const { state } = view;
  const { doc, tabSize } = state;
  const unit = getIndentUnit(state);
  const active = activeIndentGuide(state);
  const builder = new RangeSetBuilder<Decoration>();
  let last = 0;
  for (const { from, to } of view.visibleRanges) {
    for (let n = Math.max(doc.lineAt(from).number, last + 1); n <= doc.lineAt(to).number; n++) {
      last = n;
      const indent = effectiveColumn(doc, n, tabSize);
      if (indent <= 0) continue;
      const images: string[] = [], positions: string[] = [];
      for (let col = 0; col < indent; col += unit) {
        const color = active && col === active.column && n >= active.from && n <= active.to ? 'var(--indent-guide-active)' : 'var(--indent-guide)';
        images.push(`linear-gradient(${color}, ${color})`);
        positions.push(`calc(var(--indent-guide-offset) + ${col}ch) 0`);
      }
      const style = `background-image:${images.join(',')};background-position:${positions.join(',')}`;
      const line = doc.line(n);
      builder.add(line.from, line.from, Decoration.line({ attributes: { class: 'cm-indent-guides', style } }));
    }
  }
  return builder.finish();
}

export const indentGuides = [
  ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = build(view); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) this.decorations = build(update.view);
    }
  }, { decorations: plugin => plugin.decorations }),
  EditorView.theme({
    '.cm-indent-guides': { backgroundRepeat: 'no-repeat', backgroundSize: '1px 100%' },
  }),
];
