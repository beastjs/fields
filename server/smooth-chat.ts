import { smoothStream, type TextStreamPart } from 'ai';
import { EventSourceParserStream, type EventSourceMessage } from '@ai-sdk/provider-utils';

type Part = TextStreamPart<{}>;

/** Adapt the existing OpenAI-compatible wire stream to the SDK transform and back. */
export function smoothChatStream(body: ReadableStream<Uint8Array>, signal: AbortSignal, delayInMs: number | null = 10) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return body
    .pipeThrough(new TransformStream<Uint8Array, string>({
      transform(chunk, controller) { controller.enqueue(decoder.decode(chunk, { stream: true })); },
      flush(controller) { controller.enqueue(decoder.decode()); },
    }), { signal })
    // Some compatible providers close after their last data line without a blank separator.
    .pipeThrough(new TransformStream<string, string>({
      transform(chunk, controller) { controller.enqueue(chunk); },
      flush(controller) { controller.enqueue('\n\n'); },
    }), { signal })
    .pipeThrough(new EventSourceParserStream({ maxBufferSize: 256000 }), { signal })
    .pipeThrough(new TransformStream<EventSourceMessage, Part>({
      transform({ data }, controller) {
        if (data === '[DONE]') { controller.enqueue({ type: 'raw', rawValue: data }); return; }
        let event;
        try { event = JSON.parse(data); } catch { controller.enqueue({ type: 'raw', rawValue: data }); return; }
        const choice = event?.choices?.[0];
        const delta = choice?.delta;
        const reasoning = delta?.reasoning_content ?? delta?.reasoning;
        const text = delta?.content;
        if (typeof reasoning === 'string' && reasoning) controller.enqueue({ type: 'reasoning-delta', id: 'reasoning', text: reasoning });
        if (typeof text === 'string' && text) controller.enqueue({ type: 'text-delta', id: 'text', text });
        // Completion/errors flush the SDK's trailing word before reaching the browser.
        if ((!text && !reasoning) || choice?.finish_reason || event?.error) {
          if (delta) {
            delete delta.content;
            delete delta.reasoning_content;
            delete delta.reasoning;
          }
          controller.enqueue({ type: 'raw', rawValue: JSON.stringify(event) });
        }
      },
      // Flush partial output on EOF, but never manufacture a successful [DONE].
      flush(controller) { controller.enqueue({ type: 'raw', rawValue: '' }); },
    }), { signal })
    .pipeThrough(smoothStream({ delayInMs, chunking: 'word' })({ tools: {} }), { signal })
    .pipeThrough(new TransformStream<Part, Uint8Array>({
      transform(part, controller) {
        let data: string;
        if (part.type === 'text-delta' || part.type === 'reasoning-delta') {
          const field = part.type === 'text-delta' ? 'content' : 'reasoning_content';
          data = JSON.stringify({ choices: [{ index: 0, delta: { [field]: part.text }, finish_reason: null }] });
        } else if (part.type === 'raw' && typeof part.rawValue === 'string' && part.rawValue) data = part.rawValue;
        else return;
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      },
    }), { signal });
}
