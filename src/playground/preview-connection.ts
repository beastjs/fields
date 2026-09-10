import { Preview } from './preview';
import type { PlaygroundSession } from './session';

/** A collapsed pane retains this iframe and its running application. */
export function connectPreview(iframe: HTMLIFrameElement, session: PlaygroundSession) {
  const preview = new Preview(iframe, session.handlePreviewEvent);
  let revision: number | undefined;
  const sync = () => {
    const build = session.getSnapshot().previewBuild;
    if (build && build.revision !== revision) { revision = build.revision; preview.load(build.result); }
  };
  const unsubscribe = session.subscribe(sync);
  sync();
  return () => { unsubscribe(); preview.dispose(); };
}
