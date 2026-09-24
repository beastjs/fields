// The Workers runtime treats every export of the entry module as a handler, so the entry exports only the handler.
import { handler } from './app';

export default handler;
