export const DEFAULT_MODEL = 'cohere/north-mini-code-1-0';
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type AIProvider = 'cohere' | 'openrouter' | 'custom';
export const providers = [
  { id: 'cohere', label: 'Cohere' }, { id: 'openrouter', label: 'OpenRouter' },
  { id: 'custom', label: 'OpenAI-compatible' },
] as const;
export interface ChatSettings { provider: AIProvider; model: string; baseURL: string; apiKey: string }
export interface ChatTurn { role: 'user' | 'assistant'; content: string }
export interface FileContext { file: string; source: string }
/** Other project files sent as read-only context; edits still target only `context`. */
export const MAX_REFERENCES = 8;
export const MAX_REFERENCE_CHARS = 60000;
export interface ChatRequest {
  provider: AIProvider;
  model: string;
  baseURL?: string;
  apiKey?: string;
  messages: ChatTurn[];
  context?: FileContext;
  references?: FileContext[];
}
export interface AIStatus { configured: Record<AIProvider, boolean>; customBaseURL?: string }
export const defaultSettings: ChatSettings = { provider: 'cohere', model: DEFAULT_MODEL, baseURL: '', apiKey: '' };
