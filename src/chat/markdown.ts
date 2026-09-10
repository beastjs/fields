import DOMPurify from 'dompurify';
import { marked } from 'marked';

export function renderChatMarkdown(source: string) {
  return DOMPurify.sanitize(marked.parse(source, { async: false, breaks: true, gfm: true }), {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'title', 'class'],
  });
}
