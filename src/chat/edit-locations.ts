/** Exact source windows: ranking is a hint for the model, never permission to apply a fuzzy patch. */
export interface EditLocation { line: number; startLine: number; endLine: number; source: string; score: number }
const noise = new Set('a an and are as at be by change edit file for from i in is it of on please replace that the this to use want with you'.split(' '));
const terms = (text: string) => [...new Set(text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [])].filter(word => word.length > 1 && !noise.has(word));

export function locateEditLines(source: string, request: string, limit = 8): EditLocation[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const words = terms(request);
  if (!words.length) return [];
  const candidates = lines.map((text, index) => {
    const present = new Set(terms(text));
    const hits = words.filter(word => present.has(word)).length;
    return { index, score: hits / words.length };
  }).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  const locations: EditLocation[] = [];
  for (const candidate of candidates) {
    if (locations.some(location => candidate.index + 1 >= location.startLine && candidate.index + 1 <= location.endLine)) continue;
    const start = Math.max(0, candidate.index - 1), end = Math.min(lines.length, candidate.index + 2);
    const excerpt = lines.slice(start, end).join('\n');
    // Do not truncate a line and accidentally advertise it as copyable source.
    if (excerpt.length > 2400) continue;
    locations.push({ line: candidate.index + 1, startLine: start + 1, endLine: end, source: excerpt, score: candidate.score });
    if (locations.length >= limit) break;
  }
  return locations;
}

export function formatEditLocations(file: string, locations: readonly EditLocation[]) {
  return locations.map(location => `${file}:${location.startLine}-${location.endLine} (candidate target line ${location.line}; line numbers are metadata, not source):\n${location.source}`).join('\n\n');
}
