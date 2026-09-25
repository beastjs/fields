export interface LineChange { kind: 'same' | 'del' | 'add'; text: string }

/** Preserve exact line endings and unchanged islands, including when a model rewrites a block. */
export function lineChanges(before: string, after: string): LineChange[] {
  const split = (text: string) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const a = split(before), b = split(after);
  const diff = (a: string[], b: string[]): LineChange[] => {
    let start = 0, end = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    while (end < a.length - start && end < b.length - start && a[a.length - end - 1] === b[b.length - end - 1]) end++;
    const prefix = a.slice(0, start).map(text => ({ kind: 'same' as const, text }));
    const suffix = end ? a.slice(-end).map(text => ({ kind: 'same' as const, text })) : [];
    a = a.slice(start, a.length - end); b = b.slice(start, b.length - end);
    const middle: LineChange[] = [];
    if (a.length * b.length > 1_000_000) {
      // Bound memory for large rewrites; unique common lines split the remaining work.
      const unique = (lines: string[]) => {
        const positions = new Map<string, number>();
        lines.forEach((text, i) => positions.set(text, positions.has(text) ? -1 : i));
        return positions;
      };
      const left = unique(a), right = unique(b);
      let anchor = a.findIndex(text => left.get(text)! >= 0 && (right.get(text) ?? -1) >= 0);
      let other = anchor >= 0 ? right.get(a[anchor])! : -1;
      if (anchor < 0) {
        // Repetitive files still have unchanged islands. A middle anchor avoids a full rewrite
        // when two distant edits surround thousands of identical lines.
        const positions = new Map<string, number>();
        b.forEach((text, i) => {
          if (!positions.has(text) || Math.abs(i - b.length / 2) < Math.abs(positions.get(text)! - b.length / 2)) positions.set(text, i);
        });
        for (let distance = 0; distance < a.length && anchor < 0; distance++) {
          const i = (Math.floor(a.length / 2) + distance) % a.length;
          if (positions.has(a[i])) { anchor = i; other = positions.get(a[i])!; }
        }
      }
      if (anchor >= 0) {
        middle.push(...diff(a.slice(0, anchor), b.slice(0, other)), { kind: 'same', text: a[anchor] }, ...diff(a.slice(anchor + 1), b.slice(other + 1)));
      } else middle.push(...a.map(text => ({ kind: 'del' as const, text })), ...b.map(text => ({ kind: 'add' as const, text })));
    } else {
      const width = b.length + 1;
      const lengths = new Uint32Array((a.length + 1) * width);
      for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
        lengths[i * width + j] = a[i] === b[j] ? 1 + lengths[(i + 1) * width + j + 1]
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
      }
      let i = 0, j = 0;
      while (i < a.length || j < b.length) {
        if (i < a.length && j < b.length && a[i] === b[j]) { middle.push({ kind: 'same', text: a[i++] }); j++; }
        else if (i < a.length && (j === b.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) middle.push({ kind: 'del', text: a[i++] });
        else middle.push({ kind: 'add', text: b[j++] });
      }
    }
    return [...prefix, ...middle, ...suffix];
  };
  return diff(a, b);
}

/** CodeMirror edits use original offsets, leaving unchanged lines and their selections intact. */
export function sourceChanges(before: string, after: string) {
  const changes: { from: number; to: number; insert: string }[] = [];
  let offset = 0;
  let pending: typeof changes[number] | undefined;
  for (const line of lineChanges(before, after)) {
    if (line.kind === 'same') { pending = undefined; offset += line.text.length; continue; }
    if (!pending) { pending = { from: offset, to: offset, insert: '' }; changes.push(pending); }
    if (line.kind === 'del') { offset += line.text.length; pending.to = offset; }
    else pending.insert += line.text;
  }
  return changes;
}
