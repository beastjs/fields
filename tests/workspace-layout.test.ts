import { expect, test } from 'bun:test';
import type { PanelQuery } from '../src/playground/panel-query';
import { WorkspaceLayout } from '../src/playground/workspace-layout';

const query = (overrides: Partial<PanelQuery> = {}): PanelQuery => ({
  dock: null,
  split: null,
  rows: null,
  panes: null,
  order: null,
  ...overrides,
});

test('reordering keeps each pane size and persists the shareable order', () => {
  const layout = new WorkspaceLayout(false, query({ dock: [14, 68, 18], split: [50, 50] }));
  let persisted: PanelQuery | undefined;
  layout.connectPersistence(value => { persisted = value; });

  layout.reorder('chat', 'files');

  expect(layout.getSnapshot().order).toEqual(['preview', 'editor', 'files', 'chat']);
  expect(persisted?.order).toEqual(['preview', 'editor', 'files', 'chat']);
  expect(persisted?.panes).toEqual([34, 34, 14, 18]);
  expect(layout.getSnapshot().chat).toBe(true);
  expect(layout.getSnapshot().files).toBe(true);
});

test('restoring and resetting order updates the observable layout state', () => {
  const layout = new WorkspaceLayout(false, query());
  let notifications = 0;
  layout.subscribe(() => { notifications++; });

  layout.restore(query({ panes: [25, 25, 25, 25], order: ['preview', 'chat', 'files', 'editor'] }));
  expect(layout.getSnapshot().order).toEqual(['preview', 'chat', 'files', 'editor']);
  expect(notifications).toBe(1);

  layout.reset();
  expect(layout.getSnapshot().order).toEqual(['chat', 'preview', 'editor', 'files']);
  expect(layout.getSnapshot().chat).toBe(true);
  expect(layout.getSnapshot().files).toBe(false);
  expect(notifications).toBe(2);
});

test('any other visible workbench pane allows a pane to collapse', () => {
  const layout = new WorkspaceLayout(false, query({
    panes: [25, 25, 0, 50],
    order: ['files', 'editor', 'preview', 'chat'],
  }));
  expect(layout.canCollapse('files')).toBe(true);
  expect(layout.canCollapse('editor')).toBe(true);
  expect(layout.canCollapse('chat')).toBe(true);

  layout.restore(query({ panes: [0, 0, 0, 100], order: ['files', 'editor', 'preview', 'chat'] }));
  expect(layout.canCollapse('chat')).toBe(false);
  expect(layout.canCollapse('output')).toBe(true);
});

test('arranging previews pane order and only persists it when finished', () => {
  const layout = new WorkspaceLayout(false, query());
  let persisted: PanelQuery | undefined;
  layout.connectPersistence(value => { persisted = value; });

  layout.beginArranging();
  layout.previewOrder(['chat', 'files', 'editor', 'preview']);

  expect(layout.getSnapshot().arranging).toBe(true);
  expect(layout.getSnapshot().arrangeOrder).toEqual(['chat', 'files', 'editor', 'preview']);
  expect(layout.getSnapshot().order).toEqual(['chat', 'preview', 'editor', 'files']);
  expect(persisted).toBeUndefined();

  layout.finishArranging();

  expect(layout.getSnapshot().arranging).toBe(false);
  expect(layout.getSnapshot().order).toEqual(['chat', 'files', 'editor', 'preview']);
  expect(persisted?.order).toEqual(['chat', 'files', 'editor', 'preview']);
});
