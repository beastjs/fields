import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { diffBlock } from './diff';
import { normalizeFences } from './fences';

/** `original` is the attached file, used to number the rows of any diff in the reply. */
export function renderChatMarkdown(source: string, original?: string) {
  const renderer = new marked.Renderer();
  const code = renderer.code.bind(renderer);
  renderer.code = token => diffBlock(token.text, original) ?? code(token);
  return DOMPurify.sanitize(marked.parse(normalizeFences(source), { async: false, breaks: true, gfm: true, renderer }), {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'span', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'title', 'class'],
  });
}
