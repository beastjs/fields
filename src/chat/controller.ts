import type { FetchLike } from './contracts';
import type { AIStatus, ChatRequest, ChatSettings, ChatTurn, FileContext } from './contracts';
import { streamChat } from './transport';

export interface ChatMessage extends ChatTurn { context?: FileContext; projectGeneration?: number; id: number; model?: string; state?: 'complete' | 'streaming' | 'stopped' | 'error' }
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
  private disposed = false;
  constructor(settings: ChatSettings, private persist: (settings: ChatSettings) => void, private send: FetchLike = fetch) {
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
  async submit(prompt: string, context?: FileContext, projectGeneration?: number) {
    if (this.state.busy || !prompt.trim()) return;
    if (prompt.length > 32000) { this.patch({ error: 'Keep your message under 32,000 characters.' }); return; }
    if (context && context.source.length > 60000) { this.patch({ error: 'This file is too large to attach. Turn off active-file context or select a smaller file.' }); return; }
    const user: ChatMessage = { id: ++this.sequence, role: 'user', content: prompt.trim() };
    const messages = [...this.state.messages, user];
    this.patch({ messages });
    const settings = this.state.settings;
    const request: ChatRequest = { ...settings, messages: messages.filter(message => message.state !== 'error' && message.state !== 'stopped').slice(-30).map(({ role, content }) => ({ role, content })), context };
    this.lastRequest = request;
    this.lastGeneration = projectGeneration;
    await this.run(request);
  }
  private async run(request: ChatRequest) {
    const abort = new AbortController(); this.abort = abort;
    const id = ++this.sequence;
    this.patch({ busy: true, error: '', messages: [...this.state.messages, { id, role: 'assistant', content: '', model: request.model, state: 'streaming', context: request.context ? { ...request.context } : undefined, projectGeneration: this.lastGeneration }] });
    const update = (patch: Partial<ChatMessage>) => this.patch({ messages: this.state.messages.map(message => message.id === id ? { ...message, ...patch } : message) });
    try {
      await streamChat(request, content => { if (this.abort === abort) update({ content }); }, abort.signal, this.send);
      if (this.abort === abort) update({ state: 'complete' });
    } catch (error) {
      if (this.abort !== abort) return;
      update({ state: abort.signal.aborted ? 'stopped' : 'error' });
      if (!abort.signal.aborted) this.patch({ error: error instanceof Error ? error.message : 'The response failed. Please retry.' });
    } finally { if (this.abort === abort) { this.abort = undefined; this.patch({ busy: false }); } }
  }
  stop = () => { this.abort?.abort(); };
  retry = async () => {
    if (!this.lastRequest || this.state.busy) return;
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
