import type { FileContext } from './contracts';

export interface FileRecommendation { file: string; source: string }

/** Only explicit complete-file blocks are actionable; ordinary snippets stay illustrative. */
export function fileRecommendation(content: string, context?: FileContext): FileRecommendation | undefined {
  if (!context) return;
  const blocks = [...content.matchAll(/^```(?:btsx|tsrx|tsx|typescript|ts|javascript|js|css|json) file=(\/[^\s]+)\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
  if (blocks.length !== 1 || blocks[0][1] !== context.file) return;
  const source = blocks[0][2].replace(/\r\n/g, '\n');
  if (source.length > 60000 || source === context.source) return;
  return { file: context.file, source };
}
