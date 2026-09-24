import { handleAIRequest } from '../../server/chat-api';
import { handleJevRequest } from '../../server/jev-api';

/** The editor's server routes, which run as Rsbuild middleware locally (server/middleware.ts). */
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  COHERE_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  AI_CUSTOM_API_KEY?: string;
  AI_CUSTOM_BASE_URL?: string;
  TYPESAFE_API_KEY?: string;
}

/** Same bound as the Node middleware: chat requests carry project context, but never this much. */
const MAX_BODY_BYTES = 256_000;
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    const jev = path.startsWith('/api/jev/');
    if (!jev && !path.startsWith('/api/ai/')) return env.ASSETS.fetch(request);

    let routed = request;
    if (request.body) {
      if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return json({ error: 'Chat request is too large.' }, 413);
      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_BODY_BYTES) return json({ error: 'Chat request is too large.' }, 413);
      routed = new Request(request, { body });
    }
    try {
      return jev
        ? await handleJevRequest(routed, { TYPESAFE_API_KEY: env.TYPESAFE_API_KEY })
        : await handleAIRequest(routed, {
            COHERE_API_KEY: env.COHERE_API_KEY,
            OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
            AI_CUSTOM_API_KEY: env.AI_CUSTOM_API_KEY,
            AI_CUSTOM_BASE_URL: env.AI_CUSTOM_BASE_URL,
          });
    } catch {
      return json({ error: 'The chat connection ended. Please retry.' }, 500);
    }
  },
};
