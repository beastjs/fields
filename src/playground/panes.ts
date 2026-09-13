import type { IconName } from '@/lib/icons'

export interface Pane {
  id: string
  label: string
  icon: IconName
}

export const paneDefinitions = [
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'editor', label: 'Editor', icon: 'editor' },
  { id: 'preview', label: 'Preview', icon: 'browser' },
  { id: 'output', label: 'Output', icon: 'terminal' },
  { id: 'chat', label: 'Assistant', icon: 'sparkle' }
] as const satisfies readonly Pane[]

export type PaneId = (typeof paneDefinitions)[number]['id']

export const workbenchPaneIds = ['files', 'editor', 'preview', 'chat'] as const satisfies readonly PaneId[]
export type WorkbenchPaneId = (typeof workbenchPaneIds)[number]

export const isWorkbenchPaneId = (value: string): value is WorkbenchPaneId =>
  workbenchPaneIds.includes(value as WorkbenchPaneId)
