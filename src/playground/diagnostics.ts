import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import type { Diagnostic, Position } from './contracts';

export function mapPosition(position: Position, sourceMap?: string): Position {
  if (!sourceMap) return position;
  const original = originalPositionFor(new TraceMap(sourceMap), {
    line: position.line, column: Math.max(0, position.column - 1),
  });
  return original.line === null ? position : { line: original.line, column: original.column + 1 };
}

export function offsetPosition(source: string, offset: number): Position {
  const lines = source.slice(0, Math.max(0, offset)).split('\n');
  return { line: lines.length, column: lines.at(-1)!.length + 1 };
}

export function normalizeError(error: unknown, file: string, source: Diagnostic['source'], sourceMap?: string): Diagnostic {
  const detail = error as { diagnostic?: { code: string; message: string; severity: Diagnostic['severity']; span: { start: Position; end: Position } }; message?: string; code?: string; loc?: { line?: number; column?: number; start?: Position }; lineNumber?: number; column?: number } | null;
  if (detail?.diagnostic) {
    const d = detail.diagnostic;
    return { file, source, code: d.code, message: d.message, severity: d.severity, start: d.span.start, end: d.span.end };
  }
  const loc = detail?.loc?.start ?? detail?.loc;
  const start = { line: loc?.line ?? detail?.lineNumber ?? 1, column: (loc?.column ?? detail?.column ?? 0) + 1 };
  return { file, source, severity: 'error', code: detail?.code,
    message: detail?.message ?? String(error), start: mapPosition(start, sourceMap) };
}
