import { Preview } from './preview';
import type { PlaygroundSession } from './session';
import { installedThemeCss } from './studio/themes';

/** A collapsed pane retains this iframe and its running application. */
export function connectPreview(iframe: HTMLIFrameElement, session: PlaygroundSession, hostedURL?: string) {
  const initial = session.getSnapshot();
  let mode = initial.previewMode;
  let theme = initial.theme;
  let preview = new Preview(iframe, session.handlePreviewEvent, theme, mode === 'hosted' ? hostedURL : undefined);
  let tokens = initial.studioThemeCss ?? installedThemeCss(initial.project.files);
  if (tokens) preview.setTokens(tokens);
  let generation = initial.projectGeneration;
  let revision: number | undefined;
  const sync = () => {
    const state = session.getSnapshot();
    let recreated = false;
    if (generation !== state.projectGeneration || mode !== state.previewMode) {
      mode = state.previewMode;
      theme = state.theme;
      generation = state.projectGeneration;
      revision = undefined;
      preview.dispose();
      preview = new Preview(iframe, session.handlePreviewEvent, state.theme, mode === 'hosted' ? hostedURL : undefined);
      recreated = true;
    }
    const nextTokens = state.studioThemeCss ?? installedThemeCss(state.project.files);
    if (recreated || tokens !== nextTokens) { tokens = nextTokens; preview.setTokens(tokens); }
    const build = state.previewBuild;
    if (theme !== state.theme) { theme = state.theme; preview.setTheme(theme); }
    if (build && build.revision !== revision) { revision = build.revision; preview.load(build.result, build.forceReload); }
  };
  const unsubscribe = session.subscribe(sync);
  sync();
  return () => { unsubscribe(); preview.dispose(); };
}
