import { Preview } from './preview';
import type { PlaygroundSession } from './session';

/** A collapsed pane retains this iframe and its running application. */
export function connectPreview(iframe: HTMLIFrameElement, session: PlaygroundSession) {
  let theme = session.getSnapshot().theme;
  let preview = new Preview(iframe, session.handlePreviewEvent, theme);
  let generation = session.getSnapshot().projectGeneration;
  let revision: number | undefined;
  const sync = () => {
    const state = session.getSnapshot();
    if (generation !== state.projectGeneration) {
      generation = state.projectGeneration;
      revision = undefined;
      preview.dispose();
      preview = new Preview(iframe, session.handlePreviewEvent, state.theme);
    }
    const build = state.previewBuild;
    if (theme !== state.theme) { theme = state.theme; preview.setTheme(theme); }
    if (build && build.revision !== revision) { revision = build.revision; preview.load(build.result, build.forceReload); }
  };
  const unsubscribe = session.subscribe(sync);
  sync();
  return () => { unsubscribe(); preview.dispose(); };
}
