import type { Candidate, RankedFile } from '../jev/chat';
import { MAX_QUESTIONS } from '../jev/contracts';
import { JevNotConfigured, jevConfigured } from '../jev/status';
import type { CompilationProject } from '../playground/contracts';
import { MAX_REFERENCE_CHARS, MAX_REFERENCES } from './contracts';
import { chatReferences, relatedFiles } from './project-context';

export interface ReferenceSelection {
  prompt: string;
  project: CompilationProject;
  activeFile: string;
  includeActive: boolean;
  picked: string[];
  excluded: string[];
}

export type RankReferences = (input: {
  prompt: string;
  activeFile?: string;
  candidates: Candidate[];
}, signal: AbortSignal) => Promise<RankedFile[]>;

const viaJev: RankReferences = async (input, signal) => {
  if (!(await jevConfigured())) throw new JevNotConfigured();
  signal.throwIfAborted();
  const [{ runJev }, { rankReferences }] = await Promise.all([import('../jev/browser'), import('../jev/chat')]);
  signal.throwIfAborted();
  // Keep the full ranking: if a large file does not fit, a smaller candidate can take its place.
  return runJev(rankReferences(input, input.candidates.length), undefined, signal);
};

export function defaultChatReferences(input: ReferenceSelection) {
  const picked = [...new Set(input.picked)].filter(file => input.project.files[file] !== undefined && !(input.includeActive && file === input.activeFile));
  const related = input.includeActive ? relatedFiles(input.project, input.activeFile).filter(file => !input.excluded.includes(file)) : [];
  return chatReferences(input.project, picked, related);
}

export function sameReferenceSelection(a: ReferenceSelection | undefined, b: ReferenceSelection) {
  return !!a && a.project === b.project && a.prompt === b.prompt && a.activeFile === b.activeFile && a.includeActive === b.includeActive &&
    a.picked.length === b.picked.length && a.picked.every((file, index) => file === b.picked[index]) &&
    a.excluded.length === b.excluded.length && a.excluded.every((file, index) => file === b.excluded[index]);
}

/** Manual picks take priority; Jev orders automatic additions before import-graph fallbacks. */
export async function selectChatReferences(
  input: ReferenceSelection,
  signal: AbortSignal,
  rank: RankReferences = viaJev,
) {
  signal.throwIfAborted();
  const { project, activeFile, includeActive, prompt } = input;
  const picked = [...new Set(input.picked)].filter(file =>
    project.files[file] !== undefined && !(includeActive && file === activeFile));
  const excluded = new Set(input.excluded);
  const related = includeActive ? relatedFiles(project, activeFile).filter(file => !excluded.has(file)) : [];
  const fallback = chatReferences(project, picked, related);
  const remaining = MAX_REFERENCE_CHARS - picked.reduce((sum, file) => sum + project.files[file].length, 0);
  if (!prompt.trim() || picked.length >= MAX_REFERENCES || remaining <= 0) return fallback;

  // An unchecked active file must not sneak back in as an automatic reference.
  const paths = Object.keys(project.files).filter(file =>
    file !== activeFile && !picked.includes(file) && !excluded.has(file) && project.files[file].length <= remaining);
  // Prefer named files if a project exceeds the evaluation's candidate limit.
  const priority = (file: string) => prompt.includes(file) || prompt.includes(file.split('/').at(-1)!) ? 2 : related.includes(file) ? 1 : 0;
  paths.sort((a, b) => priority(b) - priority(a));
  const shortlist = paths.slice(0, MAX_QUESTIONS);
  if (!shortlist.length) return fallback;
  const excerptLength = Math.min(1200, Math.floor(48000 / shortlist.length));
  const candidates = shortlist.map(path => ({ path, outline: project.files[path].slice(0, excerptLength) }));
  const allowed = new Set(shortlist);

  // Bound the whole pre-send step, including the status check, module load and retries.
  const timeout = new AbortController();
  const pending = AbortSignal.any([signal, timeout.signal]);
  const timer = setTimeout(() => timeout.abort(), 5000);
  let cancel: () => void = () => {};
  try {
    const interrupted = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(pending.reason);
      pending.addEventListener('abort', cancel, { once: true });
    });
    const ranked = await Promise.race([rank({ prompt, activeFile, candidates }, pending), interrupted]);
    signal.throwIfAborted();
    return chatReferences(project, picked, [...ranked.map(file => file.path).filter(path => allowed.has(path)), ...related]);
  } catch {
    // Cancellation must never turn into a fallback send. Unavailability can.
    signal.throwIfAborted();
    return fallback;
  } finally {
    clearTimeout(timer);
    pending.removeEventListener('abort', cancel);
  }
}
