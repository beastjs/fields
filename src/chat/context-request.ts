import { normalizeFences } from './fences';

/** Only workspace paths can be requested; this protocol never reads the host filesystem. */
export function requestedFiles(reply: string, paths: readonly string[], attached: readonly string[]) {
  const content = normalizeFences(reply);
  const block = /^```context\s*\n([\s\S]*?)^```\s*$/m.exec(content);
  let requested: string[] = [];
  if (block) {
    try {
      const value: unknown = JSON.parse(block[1]);
      if (Array.isArray(value)) requested = value.filter((path): path is string => typeof path === 'string');
    } catch { /* A malformed request can still name an exact known path below. */ }
  }
  // Recover older models that still ask for attachments or propose an unseen target.
  const targets = [...content.matchAll(/(?:patch|file)=['"]?([^\s'"`]+)/g)].map(match => match[1]);
  requested.push(...targets);
  if (block || /\b(attach|include|open|select|provide|need|missing)\b/i.test(content) || targets.length) {
    requested.push(...paths.filter(path => content.includes(path)));
    if (!targets.length && !block) requested.push(...paths.filter(path => {
      const basename = path.split('/').at(-1)!;
      return content.includes(basename) && paths.filter(other => other.split('/').at(-1) === basename).length === 1;
    }));
  }
  const normalize = (path: string) => '/' + path.replace(/^\.?\/+/, '');
  return [...new Set(requested.map(normalize))].filter(path => paths.includes(path) && !attached.includes(path));
}
