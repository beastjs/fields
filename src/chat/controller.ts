import { fileRecommendation } from './recommendation';
import type { FetchLike } from './contracts';
import { MAX_PROJECT_PATHS, MAX_REFERENCE_CHARS, MAX_REFERENCES, type AIStatus, type ChatRequest, type ChatSettings, type ChatTurn, type FileContext } from './contracts';
import { streamChat } from './transport';
import { requestedFiles } from './context-request';

export interface ChatMessage extends ChatTurn { reasoning?: string; context?: FileContext; references?: FileContext[]; attachments?: string[]; projectGeneration?: number; id: number; attempt?: number; model?: string; state?: 'complete' | 'streaming' | 'stopped' | 'error' }
export interface ChatSnapshot {
  settings: ChatSettings;
  messages: ChatMessage[];
  busy: boolean;
  error: string;
  status?: AIStatus;
  connectionError: string;
}
export class ChatController {
  private state: ChatSnapshot;
  private listeners = new Set<() => void>();
  private sequence = 0;
  private abort?: AbortController;
  private statusAbort = new AbortController();
  private lastRequest?: ChatRequest;
  private lastGeneration?: number;
  private lastAttempt = 1;
  private disposed = false;
  constructor(settings: ChatSettings, private persist: (settings: ChatSettings) => void, private send: FetchLike = fetch,
    private workspace?: () => { files: Record<string, string>; generation: number; activeFile?: string }) {
    this.state = { settings, messages: [], busy: false, error: '', connectionError: '' };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(patch: Partial<ChatSnapshot>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  async checkConnection() {
    if (this.disposed) return;
    try {
      const send = this.send;
      const response = await send('/api/ai/status', { signal: this.statusAbort.signal });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error();
      const status = await response.json() as AIStatus;
      if (!status.configured || typeof status.configured.cohere !== 'boolean') throw new Error();
      this.patch({ status, connectionError: '' });
    } catch { if (!this.disposed) this.patch({ connectionError: 'Chat server unavailable. Run bun run dev or bun run preview.' }); }
  }
  configure = (settings: ChatSettings) => {
    this.persist(settings);
    this.patch({ settings: { ...settings }, error: '' });
  };
  /**
   * `attempt` counts automatic fix-up rounds for one request: 1 for the user's own message.
   * `files` lists every current project path, so the model knows what exists beyond the attached sources.
   */
  async submit(prompt: string, context?: FileContext, projectGeneration?: number, references: FileContext[] = [], attempt = 1, files: string[] = []) {
    if (this.disposed || this.state.busy || !prompt.trim()) return;
    if (prompt.length > 32000) { this.patch({ error: 'Keep your message under 32,000 characters.' }); return; }
    if (context && context.source.length > 60000) { this.patch({ error: 'This file is too large to attach. Turn off active-file context or select a smaller file.' }); return; }
    if (references.length > MAX_REFERENCES) { this.patch({ error: `Include at most ${MAX_REFERENCES} other files.` }); return; }
    if (references.reduce((sum, reference) => sum + reference.source.length, 0) > MAX_REFERENCE_CHARS) { this.patch({ error: 'The included files are too large together (60,000 characters maximum). Remove one and retry.' }); return; }
    const attachments = [...(context ? [context.file] : []), ...references.map(reference => reference.file)];
    const user: ChatMessage = { id: ++this.sequence, role: 'user', content: prompt.trim(), attachments: attachments.length ? attachments : undefined, attempt: attempt > 1 ? attempt : undefined };
    const messages = [...this.state.messages, user];
    this.patch({ messages });
    const settings = this.state.settings;
    // Do not let rejected patches and repair chatter become evidence for the next edit.
    // A repair is self-contained: original intent, exact current source, and located lines.
    const history = attempt > 1 ? [user] : messages.filter(message => {
      if (message.state === 'error' || message.state === 'stopped') return false;
      if (message.role === 'user') return !message.attempt;
      return message.attempt === 1 && !fileRecommendation(message.content, message.context, message.references)?.error;
    });
    const request: ChatRequest = { ...settings, messages: history.slice(-30).map(({ role, content }) => ({ role, content })), context, references: references.length ? references : undefined, files: files.length ? files.slice(0, MAX_PROJECT_PATHS) : undefined };
    this.lastRequest = request;
    this.lastGeneration = projectGeneration;
    this.lastAttempt = attempt;
    await this.run(request);
  }
  private async run(request: ChatRequest) {
    if (this.disposed) return;
    const abort = new AbortController(); this.abort = abort;
    const id = ++this.sequence;
    this.patch({ busy: true, error: '', messages: [...this.state.messages, { id, role: 'assistant', content: '', model: request.model, state: 'streaming', context: request.context ? { ...request.context } : undefined, references: request.references?.map(reference => ({ ...reference })), projectGeneration: this.lastGeneration, attempt: this.lastAttempt }] });
    const update = (patch: Partial<ChatMessage>) => this.patch({ messages: this.state.messages.map(message => message.id === id ? { ...message, ...patch } : message) });
    try {
      for (let round = 0; ; round++) {
        let reply = '';
        await streamChat(request, content => { reply = content; if (this.abort === abort) update({ content }); }, abort.signal, this.send, reasoning => { if (this.abort === abort) update({ reasoning }); });
        abort.signal.throwIfAborted();
        if (this.abort !== abort) return;
        const workspace = this.workspace?.();
        if (!workspace) break;
        const attached = [request.context, ...(request.references ?? [])].filter((file): file is FileContext => !!file);
        const needed = requestedFiles(reply, Object.keys(workspace.files), attached.map(file => file.file));
        if (!attached.length && workspace.activeFile && /(?:\b(?:attach|select|include|open)\b[\s\S]{0,80}\bfile\b|<<<<<<< SEARCH)/i.test(reply)) {
          if (!needed.includes(workspace.activeFile)) needed.push(workspace.activeFile);
        }
        if (!needed.length) {
          if (/^```context\s*$/m.test(reply)) {
            if (round >= 4) throw new Error('The assistant could not resolve its context request. Try a more focused request.');
            request = { ...request, messages: [...request.messages.slice(0, -1), { role: 'user', content:
              request.messages.at(-1)!.content + '\nAll requested existing files are already attached, or the requested paths are not in this project. Use the supplied source to answer; request only missing paths from the project list.' }] };
            update({ content: '', reasoning: undefined });
            continue;
          }
          break;
        }
        if (workspace.generation !== this.lastGeneration || attached.some(file => workspace.files[file.file] !== file.source)) {
          throw new Error('The project changed while gathering files. Retry with the current source.');
        }
        if (round >= 4) throw new Error('The assistant could not finish gathering context. Retry with a more focused request.');
        // Promote the requested owner to primary context; evict background references if needed.
        const context = { file: needed[0], source: workspace.files[needed[0]] };
        if (context.source.length > 60000) throw new Error(`${context.file} exceeds the 60,000-character context limit.`);
        let characters = 0;
        const references = [...needed.slice(1).map(file => ({ file, source: workspace.files[file] })), ...attached]
          .filter((file, index, all) => file.file !== context.file && all.findIndex(other => other.file === file.file) === index)
          .filter(file => {
            if (characters + file.source.length > MAX_REFERENCE_CHARS) return false;
            characters += file.source.length;
            return true;
          }).slice(0, MAX_REFERENCES);
        request = { ...request, context, references, files: Object.keys(workspace.files).slice(0, MAX_PROJECT_PATHS) };
        this.lastRequest = request;
        update({ content: '', reasoning: undefined, context, references });
        const user = this.state.messages.filter(message => message.role === 'user').at(-1);
        if (user) this.patch({ messages: this.state.messages.map(message => message.id === user.id
          ? { ...message, attachments: [context.file, ...references.map(file => file.file)] } : message) });
      }
      if (this.abort === abort) update({ state: 'complete' });
    } catch (error) {
      if (this.abort !== abort) return;
      update({ state: abort.signal.aborted ? 'stopped' : 'error' });
      if (!abort.signal.aborted) this.patch({ error: error instanceof Error ? error.message : 'The response failed. Please retry.' });
    } finally { if (this.abort === abort) { this.abort = undefined; this.patch({ busy: false }); } }
  }
  /** Reference files sent with the last request, so a fix-up round can include them again. */
  get lastReferences() { return this.lastRequest?.references ?? []; }
  stop = () => { this.abort?.abort(); };
  retry = async () => {
    if (this.disposed || !this.lastRequest || this.state.busy) return;
    const messages = this.state.messages.slice();
    if (messages.at(-1)?.role === 'assistant') messages.pop();
    this.patch({ messages });
    await this.run({ ...this.lastRequest, ...this.state.settings });
  };
  clear = () => {
    this.abort?.abort(); this.abort = undefined; this.lastRequest = undefined;
    this.patch({ messages: [], busy: false, error: '' });
  };
  dispose() { this.disposed = true; this.abort?.abort(); this.statusAbort.abort(); this.listeners.clear(); }
}
