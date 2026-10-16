import type { ChatRequest, ChatSettings, FetchLike } from './contracts'
import { NODE_BYTES, splitMemoryText, utf8Bytes, type SummarizeMemory } from './memory'
import { streamChat } from './transport'

export function createMemoryCompactor(settings: () => ChatSettings, send: FetchLike = fetch): SummarizeMemory {
  return async (source, context, signal) => {
    const messages: ChatRequest['messages'] = [{ role: 'user', content:
      `Compress this message or pair of adjacent summary lines into one line of at most ${NODE_BYTES} UTF-8 bytes (about 70 words). Preserve user decisions, constraints, file paths, unfinished work and uncertainty. Assistant edits are proposals unless verification is explicitly recorded. Use the project memory for context.\n<input>\n${source}\n</input>` }]
    let shortest = ''
    // Victral retries oversized responses five times and keeps the shortest, without truncating it.
    for (let attempt = 0; attempt < 5; attempt++) {
      let text = ''
      await streamChat({ ...settings(), messages, purpose: 'compaction', memory: { view: context } }, value => { text = value }, signal, send)
      text = text.trim().replace(/\r\n|\r|\n/g, ' ')
      if (!shortest || utf8Bytes(text) < utf8Bytes(shortest)) shortest = text
      if (utf8Bytes(text) <= NODE_BYTES) break
      messages.push({ role: 'assistant', content: text }, { role: 'user', content: `Too long: ${utf8Bytes(text)} bytes; the limit is ${NODE_BYTES}. Rewrite the same input, cutting the least valuable details. Limit marker:\n${splitMemoryText(text, NODE_BYTES)[0]}| ← LIMIT` })
    }
    return shortest
  }
}
