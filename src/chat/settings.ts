import { DEFAULT_MODEL, defaultSettings, type ChatSettings } from './contracts';

const key = 'beast-playground.chat-settings.v1';
export function readChatSettings(): ChatSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || !['cohere', 'openrouter', 'meta', 'custom'].includes(value.provider) || typeof value.model !== 'string' || !value.model.trim() || value.model.length > 200) return { ...defaultSettings };
    const model = value.provider === 'meta' && value.model.trim() === 'muse-spark-1.5-contributor' ? DEFAULT_MODEL : value.model.trim();
    return { provider: value.provider, model, baseURL: typeof value.baseURL === 'string' ? value.baseURL.slice(0, 2048) : '', apiKey: '' };
  } catch { return { ...defaultSettings }; }
}
export function saveChatSettings({ provider, model, baseURL }: ChatSettings) {
  // Credentials and conversation content never enter this settings record.
  try { localStorage.setItem(key, JSON.stringify({ provider, model, baseURL })); } catch { /* Session-only settings still work. */ }
}
