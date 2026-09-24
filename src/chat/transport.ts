import type { FetchLike } from './contracts';
import type { ChatRequest } from './contracts';

/** Decode OpenAI-compatible SSE, including UTF-8 and events split across chunks. */
export async function streamChat(input: ChatRequest, onText: (text: string) => void, signal: AbortSignal, send: FetchLike = fetch, onReasoning?: (text: string) => void) {
  const response = await send('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === 'string' ? body.error : 'Chat is unavailable. Start the playground with its local server and retry.');
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('The chat server did not return a response stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '', reasoning = '', ended = false, finished = false;
  const event = (data: string) => {
    if (data === '[DONE]') { ended = true; return; }
    if (!data) return;
    let value;
    try { value = JSON.parse(data); } catch { throw new Error('The provider returned an invalid stream. Please retry.'); }
    if (value.error) throw new Error('The provider stopped this response. Check the model settings and retry.');
    const choice = value.choices?.[0];
    const thought = choice?.delta?.reasoning_content ?? choice?.delta?.reasoning;
    if (typeof thought === 'string') {
      reasoning += thought;
      if (text.length + reasoning.length > 128000) throw new Error('The response reached the display limit. Ask for a smaller change.');
      onReasoning?.(reasoning);
    }
    if (typeof choice?.delta?.content === 'string') {
      text += choice.delta.content;
      if (text.length + reasoning.length > 128000) throw new Error('The response reached the display limit. Ask for a smaller change.');
      onText(text);
    }
    if (choice?.finish_reason) finished = true;
  };
  const drain = (final = false) => {
    buffer = buffer.replace(/\r\n/g, '\n');
    let index;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, index); buffer = buffer.slice(index + 2);
      event(block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'));
    }
    if (final && buffer.trim()) { event(buffer.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')); buffer = ''; }
    if (buffer.length > 256000) throw new Error('The provider returned an oversized event.');
  };
  try {
    while (!ended) {
      const chunk = await reader.read();
      if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
      if (chunk.done) { buffer += decoder.decode(); drain(true); break; }
      buffer += decoder.decode(chunk.value, { stream: true }); drain();
    }
    if (!ended && !finished) throw new Error('The connection ended before the response finished. You can retry.');
    if (!text.trim()) throw new Error('The model returned no answer. Try another prompt or model.');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
