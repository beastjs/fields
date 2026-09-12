import { StreamLanguage, type StreamParser, type StringStream } from '@codemirror/language';

// A lexical highlighting mode only; compilation and validation belong to Beast.
// Scopes follow src/lib/grammar/btsx.tmLanguage.json, with template text kept plain and
// setup/module/props/control lines tokenized as TypeScript.

type Phase = 'head' | 'component' | 'element' | 'attrs' | 'text' | 'code' | 'each' | 'eachExpr';

export interface BtsxState {
  /** Indentation of an open `setup`/`module` block header, or -1 outside one. */
  codeIndent: number;
  phase: Phase;
  /** An element's attribute list is open and continues on `~` lines. */
  attrs: boolean;
  /** Open `{` depth of embedded TypeScript inside template attributes or `#{}` text. */
  braces: number;
  resume: Phase;
  template: boolean;
  comment: boolean;
  /** The previous code word was `const`, `function`, …, so the next name is a definition. */
  declaring: boolean;
}

const templateKeywords = /^(?:import|export|module|component|props|setup|if|elseif|else|each|empty|switch|case|default|try|pending|catch)(?=[\s(]|$)/;
const tsKeywords = new Set(('as async await break case catch class const continue debugger declare default delete do else enum export extends finally for from function if implements import in instanceof interface keyof let namespace new of readonly return satisfies static switch throw try type typeof var void while yield').split(' '));
const declarations = new Set(['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum']);
const atoms = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);

const isCode = (state: BtsxState) => state.braces > 0 || state.phase === 'code' || state.phase === 'each' || state.phase === 'eachExpr';

function quoted(stream: StringStream, quote: string) {
  let escaped = false, char;
  while ((char = stream.next()) !== undefined) {
    if (char === quote && !escaped) return;
    escaped = !escaped && char === '\\';
  }
}

function enterCode(state: BtsxState, resume: Phase) {
  state.braces = 1;
  state.resume = resume;
  state.phase = 'code';
  return 'punctuation.special';
}

function tokenCode(stream: StringStream, state: BtsxState): string | null {
  if (state.comment) {
    state.comment = !stream.skipTo('*/');
    if (state.comment) stream.skipToEnd(); else stream.pos += 2;
    return 'comment';
  }
  if (state.template) {
    let escaped = false, char;
    while ((char = stream.next()) !== undefined) {
      if (char === '`' && !escaped) { state.template = false; break; }
      escaped = !escaped && char === '\\';
    }
    return 'string';
  }
  if (stream.eatSpace()) return null;
  if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
  if (stream.match('/*')) { state.comment = true; return tokenCode(stream, state); }
  const char = stream.peek()!;
  if (char === '"' || char === "'") { stream.next(); quoted(stream, char); return 'string'; }
  if (char === '`') { stream.next(); state.template = true; return tokenCode(stream, state); }
  if (stream.match(/^(?:0x[\da-f]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?n?)/i)) return 'number';
  if (char === '{') { stream.next(); if (state.braces) state.braces++; return 'brace'; }
  if (char === '}') {
    stream.next();
    if (state.braces && --state.braces === 0) { state.phase = state.resume; return 'punctuation.special'; }
    return 'brace';
  }
  const word = stream.match(/^[A-Za-z_$][\w$]*/) as RegExpMatchArray | null;
  if (word) {
    const name = word[0];
    const wasDeclaring = state.declaring;
    state.declaring = false;
    if (state.phase === 'each') {
      if (name === 'in') { state.phase = 'eachExpr'; return 'keyword'; }
      return 'variableName.definition';
    }
    if (state.phase === 'eachExpr' && name === 'key') return 'keyword';
    if (stream.string.charAt(stream.start - 1) === '.') return stream.match(/^\s*\(/, false) ? 'propertyName.function' : 'propertyName';
    if (atoms.has(name)) return 'atom';
    if (name === 'this' || name === 'super') return 'self';
    if (tsKeywords.has(name)) { state.declaring = declarations.has(name); return 'keyword'; }
    if (wasDeclaring) return /^[A-Z]/.test(name) ? 'typeName.definition' : 'variableName.definition';
    if (/^[A-Z]/.test(name)) return 'typeName';
    if (stream.match(/^\s*(?:<[^>]*>\s*)?\(/, false)) return 'variableName.function';
    return 'variableName';
  }
  if (stream.match(/^(?:\.\.\.|=>|[-+*/%=<>!&|^~?:]+)/)) return 'operator';
  stream.next();
  return null;
}

function tokenText(stream: StringStream, state: BtsxState) {
  if (stream.match('#{')) return enterCode(state, 'text');
  if (stream.match(/^&(?:#\d+|#x[\da-f]+|\w+);/i)) return 'character';
  stream.next();
  while (!stream.eol() && !stream.match(/^(?:#\{|&(?:#\d+|#x[\da-f]+|\w+);)/i, false)) stream.next();
  return null;
}

export const btsxParser: StreamParser<BtsxState> = {
  name: 'btsx',
  startState: () => ({ codeIndent: -1, phase: 'head', attrs: false, braces: 0, resume: 'head', template: false, comment: false, declaring: false }),
  token(stream, state) {
    if (stream.sol()) {
      state.declaring = false;
      const open = state.braces > 0 || state.comment || state.template;
      if (state.codeIndent >= 0 && !open && stream.indentation() <= state.codeIndent) state.codeIndent = -1;
      if (state.attrs && !open && !/^\s*~/.test(stream.string)) state.attrs = false;
      if (!open) state.phase = state.codeIndent >= 0 ? 'code' : state.attrs ? 'attrs' : 'head';
    }
    if (state.comment || state.template || isCode(state)) return tokenCode(stream, state);
    switch (state.phase) {
      case 'head': {
        if (stream.eatSpace()) return null;
        if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
        if (stream.eat('|')) { state.phase = 'text'; return 'punctuation.special'; }
        const keyword = stream.match(templateKeywords) as RegExpMatchArray | null;
        if (keyword) {
          const name = keyword[0];
          if ((name === 'setup' || name === 'module') && !stream.string.slice(stream.pos).trim()) state.codeIndent = stream.indentation();
          state.phase = name === 'component' ? 'component' : name === 'each' ? 'each' : 'code';
          return 'keyword';
        }
        if (stream.match(/^[A-Z][\w$]*(?:\.[A-Za-z_$][\w$]*)*/)) { state.phase = 'element'; return 'typeName'; }
        if (stream.match(/^[a-z][\w-]*(?=[.#(\s]|$)/)) { state.phase = 'element'; return 'tagName'; }
        if (stream.match(/^[.#][\w-]+/)) { state.phase = 'element'; return 'className'; }
        state.phase = 'text';
        return tokenText(stream, state);
      }
      case 'component':
        if (stream.eatSpace()) return null;
        state.phase = 'code';
        return stream.match(/^[A-Za-z_$][\w$]*/) ? 'typeName.definition' : tokenCode(stream, state);
      case 'element':
        if (stream.match(/^[.#][\w-]+/)) return 'className';
        if (stream.eat('(')) { state.attrs = true; state.phase = 'attrs'; return 'bracket'; }
        state.phase = 'text';
        return tokenText(stream, state);
      case 'attrs': {
        if (stream.eatSpace()) return null;
        if (stream.eat('~')) return 'punctuation.special';
        if (stream.eat(')')) { state.attrs = false; state.phase = 'text'; return 'bracket'; }
        if (stream.eat('{')) return enterCode(state, 'attrs');
        const char = stream.peek()!;
        if (char === '"' || char === "'") { stream.next(); quoted(stream, char); return 'string'; }
        if (stream.match(/^[A-Za-z_:@][\w:.-]*/)) return 'attributeName';
        if (stream.eat('=')) return 'operator';
        stream.next();
        return null;
      }
      default:
        return tokenText(stream, state);
    }
  },
  languageData: { commentTokens: { line: '//' } },
};

export const btsx = StreamLanguage.define(btsxParser);
