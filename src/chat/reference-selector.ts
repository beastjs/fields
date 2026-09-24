import { defaultChatReferences, sameReferenceSelection, selectChatReferences, type ReferenceSelection } from './references';

type Result = ReturnType<typeof defaultChatReferences>;
type Selection = {
  input: ReferenceSelection;
  abort: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  promise?: Promise<Result>;
};

/** One selection shared by the checkbox preview and send; outdated evaluations cannot win. */
export class ReferenceSelector {
  private state: { input?: ReferenceSelection; result: Result; pending: boolean } = {
    result: { references: [], skipped: [] }, pending: false,
  };
  private listeners = new Set<() => void>();
  private current?: Selection;
  constructor(private select = selectChatReferences, private debounceMs = 350) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: typeof this.state) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  update(input: ReferenceSelection) {
    if (this.current && sameReferenceSelection(this.current.input, input)) return;
    this.cancel();
    const current: Selection = { input, abort: new AbortController() };
    this.current = current;
    const result = defaultChatReferences(input);
    this.publish({ input, result, pending: !!input.prompt.trim() });
    if (!input.prompt.trim()) current.promise = Promise.resolve(result);
    else current.timer = setTimeout(() => { void this.start(current).catch(() => {}); }, this.debounceMs);
  }
  private start(current: Selection): Promise<Result> {
    clearTimeout(current.timer);
    return current.promise ??= this.select(current.input, current.abort.signal).then(result => {
      current.abort.signal.throwIfAborted();
      if (this.current === current) this.publish({ input: current.input, result, pending: false });
      return result;
    });
  }
  async resolve(input: ReferenceSelection, signal: AbortSignal) {
    signal.throwIfAborted();
    this.update(input);
    const current = this.current!;
    const cancel = () => { if (this.current === current) this.cancel(); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const result = await this.start(current);
      signal.throwIfAborted();
      return result;
    } finally { signal.removeEventListener('abort', cancel); }
  }
  cancel = () => {
    if (!this.current) return;
    clearTimeout(this.current.timer);
    this.current.abort.abort();
    this.current = undefined;
    this.publish({ ...this.state, pending: false });
  };
  dispose = () => { this.cancel(); this.listeners.clear(); };
}
