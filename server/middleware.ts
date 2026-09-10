import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { handleAIRequest } from './chat-api';

/** Runs on both Rsbuild dev and preview servers. Never imported by the browser. */
export function aiMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url?.split('?')[0].startsWith('/api/ai/')) { next(); return; }
  const abort = new AbortController();
  res.on('close', () => { if (!res.writableFinished) abort.abort(); });
  void (async () => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 256000) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end('{"error":"Chat request is too large."}'); return; }
      chunks.push(Buffer.from(chunk));
    }
    const protocol = 'encrypted' in req.socket && req.socket.encrypted ? 'https' : 'http';
    const requestHeaders = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) requestHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
    const request = new Request(`${protocol}://${req.headers.host}${req.url}`, {
      method: req.method, headers: requestHeaders, signal: abort.signal,
      ...(!['GET', 'HEAD'].includes(req.method ?? 'GET') ? { body: Buffer.concat(chunks) } : {}),
    });
    const response = await handleAIRequest(request, { COHERE_API_KEY: process.env.COHERE_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY, AI_CUSTOM_API_KEY: process.env.AI_CUSTOM_API_KEY,
      AI_CUSTOM_BASE_URL: process.env.AI_CUSTOM_BASE_URL });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) await pipeline(Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream), res);
    else res.end();
  })().catch(() => {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    if (!res.destroyed) res.end('{"error":"The chat connection ended. Please retry."}');
  });
}
