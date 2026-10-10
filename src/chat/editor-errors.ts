import type { CompilationProject, Diagnostic } from '../playground/contracts';
import type { PlaygroundSession, SessionSnapshot } from '../playground/session';
import type { ChatController } from './controller';
import { chatReferences, relatedFiles } from './project-context';
import { fileRecommendation } from './recommendation';

interface PendingError {
  project: CompilationProject;
  generation: number;
  file: string;
  errors: Diagnostic[];
}

/** Starts one repair per broken file version. Pane visibility never controls its lifetime. */
export class EditorErrorRepair {
  private enabled = false;
  private disposed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: PendingError;
  private sent = new WeakMap<CompilationProject, Set<string>>();
  private inFlight?: { id: number; project: CompilationProject; generation: number };
  private disconnect: (() => void)[];

  constructor(private session: Pick<PlaygroundSession, 'getSnapshot' | 'subscribe'>,
    private chat: Pick<ChatController, 'getSnapshot' | 'subscribe' | 'submit' | 'stop'>,
    private options: { delay?: number; onRepair?: () => void } = {}) {
    this.disconnect = [session.subscribe(this.changed), chat.subscribe(this.changed)];
  }

  setEnabled(enabled: boolean) {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled && this.inFlight) this.chat.stop();
    this.changed();
  }

  private candidate(snapshot: SessionSnapshot): PendingError | undefined {
    if (!snapshot.buildError) return;
    const errors = snapshot.diagnostics.filter(diagnostic => diagnostic.severity === 'error'
      && snapshot.project.files[diagnostic.file] !== undefined
      // Worker crashes/timeouts are editor infrastructure failures, not editable source errors.
      && (diagnostic.source !== 'web' || snapshot.lastResult?.diagnostics.includes(diagnostic)));
    const file = errors[0]?.file;
    if (!file || snapshot.project.files[file].length > 60000 || this.sent.get(snapshot.project)?.has(file)) return;
    return { project: snapshot.project, generation: snapshot.projectGeneration, file, errors };
  }

  private changed = () => {
    if (this.disposed) return;
    const snapshot = this.session.getSnapshot();
    const chat = this.chat.getSnapshot();
    const latest = chat.messages.at(-1);
    if (chat.busy && latest?.origin === 'editor') {
      this.inFlight ??= { id: latest.id, project: snapshot.project, generation: snapshot.projectGeneration };
      if (this.inFlight.id === latest.id && (this.inFlight.project !== snapshot.project
        || this.inFlight.generation !== snapshot.projectGeneration)) this.chat.stop();
    } else this.inFlight = undefined;

    const candidate = this.enabled ? this.candidate(snapshot) : undefined;
    if (!candidate || chat.busy) { this.cancelPending(); return; }
    // A response already fixing this exact source uses the existing verification/repair loop.
    const attached = [latest?.context, ...(latest?.references ?? [])];
    const recommendation = latest?.state === 'complete' ? fileRecommendation(latest.content, latest.context, latest.references) : undefined;
    if (latest?.state === 'complete' && attached.some(context => context?.file === candidate.file
      && context.source === candidate.project.files[candidate.file])
      && recommendation?.file === candidate.file) {
      this.remember(candidate); this.cancelPending(); return;
    }
    if (this.pending?.project === candidate.project && this.pending.file === candidate.file
      && this.pending.generation === candidate.generation) return;
    this.cancelPending();
    this.pending = candidate;
    this.timer = setTimeout(() => this.repair(candidate), this.options.delay ?? 400);
  };

  private remember(candidate: PendingError) {
    const files = this.sent.get(candidate.project) ?? new Set<string>();
    files.add(candidate.file);
    this.sent.set(candidate.project, files);
  }

  private repair(candidate: PendingError) {
    this.cancelPending();
    const snapshot = this.session.getSnapshot();
    if (!this.enabled || this.disposed || this.chat.getSnapshot().busy
      || snapshot.project !== candidate.project || snapshot.projectGeneration !== candidate.generation
      || !this.candidate(snapshot)) return;
    this.remember(candidate); // Before submit: controller notifications are synchronous.
    const diagnostics = candidate.errors.slice(0, 10).map(error =>
      `${error.file}:${error.start.line}:${error.start.column} (${error.source}${error.code ? ` ${error.code}` : ''}): ${error.message.slice(0, 1500)}`);
    const prompt = `The editor detected an error in ${candidate.file}. Fix the reported error using the attached current source. Preserve the existing behavior and make the smallest necessary change. Return an applicable patch or complete replacement for the affected file; the editor will verify compilation and startup before applying it.\n\n${diagnostics.join('\n')}`;
    const related = [...candidate.errors.map(error => error.file), ...relatedFiles(candidate.project, candidate.file)]
      .filter(file => file !== candidate.file);
    const { references } = chatReferences(candidate.project, [], related);
    this.options.onRepair?.();
    void this.chat.submit(prompt, { file: candidate.file, source: candidate.project.files[candidate.file] },
      candidate.generation, references, 1, Object.keys(candidate.project.files), 'editor');
  }

  private cancelPending() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelPending();
    this.disconnect.forEach(disconnect => disconnect());
    if (this.inFlight) this.chat.stop();
  }
}
