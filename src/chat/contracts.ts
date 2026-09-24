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
/** Other attached project files; an explicit edit may target any attached file. */
export const MAX_REFERENCES = 8;
export const MAX_REFERENCE_CHARS = 60000;
/** Every project path is listed so the model knows which files exist, including ones added since the chat began. */
export const MAX_PROJECT_PATHS = 200;
export interface ChatRequest {
  provider: AIProvider;
  model: string;
  baseURL?: string;
  apiKey?: string;
  messages: ChatTurn[];
  context?: FileContext;
  references?: FileContext[];
  files?: string[];
}
export interface AIStatus { configured: Record<AIProvider, boolean>; customBaseURL?: string }
export const defaultSettings: ChatSettings = { provider: 'cohere', model: DEFAULT_MODEL, baseURL: '', apiKey: '' };
