const fenceLine = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
const glued = /^(.*?\S)[ \t]*(`{3,}[\w+-]*(?:[ \t]+\S+)*)[ \t]*$/;
const language = /^[\w+-]*(?:[ \t]+\S+=\S*)*$/;

/**
 * Models often mangle code fences in ways CommonMark reads as prose: an opening fence glued to
 * the end of a sentence, a closing fence glued to the last code line, or text right after a
 * closing fence. Each is moved onto its own line so the renderer and the recommendation parser
 * see the same, well-formed blocks. Content inside a block is otherwise untouched.
 */
export function normalizeFences(content: string) {
  const out: string[] = [];
  const pending = content.replace(/\r\n/g, '\n').split('\n').reverse();
  let open: string | undefined;
  while (pending.length) {
    const line = pending.pop()!;
    const fence = fenceLine.exec(line);
    if (!open) {
      if (fence) {
        if (fence[2][0] === '`' && fence[3].includes('`')) { out.push(line); continue; }
        open = fence[2];
        out.push(line);
        continue;
      }
      // "Here is the fix: ```btsx patch=/src/App.btsx". Skip lines holding inline ``` spans.
      const match = glued.exec(line);
      if (match && !match[1].includes('```') && language.test(match[2].replace(/^`+/, ''))) {
        out.push(match[1], match[2]);
        open = /^`+/.exec(match[2])![0];
        continue;
      }
      out.push(line);
      continue;
    }
    if (fence && fence[2][0] === open[0] && fence[2].length >= open.length) {
      const rest = fence[3].trim();
      // An info string on a would-be closer is literal content (e.g. a nested ```js inside ````md).
      if (!rest) { out.push(fence[1] + fence[2]); open = undefined; continue; }
      if (!/^[\w+-]+$/.test(rest)) { out.push(fence[1] + fence[2]); pending.push(rest); open = undefined; continue; }
      out.push(line);
      continue;
    }
    // "  h1 Hi```": the closing fence landed on the last code line.
    const tail = new RegExp(`^(.*[^${open[0]}\\s])[ \\t]*(${open[0] === '`' ? '`' : '~'}{${open.length}})[ \\t]*$`).exec(line);
    if (tail && !tail[1].includes(open[0].repeat(3))) {
      out.push(tail[1], tail[2]);
      open = undefined;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}
