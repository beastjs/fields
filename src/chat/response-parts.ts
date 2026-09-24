import { marked } from 'marked';
import { normalizeFences } from './fences';
import { parseHunks } from './recommendation';

/** Separate display sections without changing the original response used for copying/applying. */
export function chatResponseParts(content: string) {
  const explanation: string[] = [];
  const changes: string[] = [];
  for (const token of marked.lexer(normalizeFences(content))) {
    const change = token.type === 'code' && (
      /(?:^|\s)(?:file|patch)=/.test(token.lang ?? '') ||
      /^(?:diff|patch)(?:\s|$)/.test(token.lang ?? '') ||
      parseHunks(token.text).length > 0 || /^<{3,}[ \t]*SEARCH/m.test(token.text)
    );
    (change ? changes : explanation).push(token.raw);
  }
  return { explanation: explanation.join('').trim(), changes };
}
