import type { IconName } from '@/lib/icons'
import type { GroupImperativeHandle, Layout, PanelImperativeHandle } from '@octanejs/resizable-panels'
import { sameSizes, type PanelQuery } from './panel-query'

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
  { id: 'chat', label: 'AI chat', icon: 'sparkle' }
] as Pane[]
export type PaneId = (typeof paneDefinitions)[number]['id']
type Visibility = Record<PaneId, boolean>
const ref = <T>() => ({ current: null as T | null })

/** Layout owns pane geometry only. Project and runtime lifetimes are independent. */
export class WorkspaceLayout {
  readonly panels = {
    files: ref<PanelImperativeHandle>(),
    editor: ref<PanelImperativeHandle>(),
    preview: ref<PanelImperativeHandle>(),
    output: ref<PanelImperativeHandle>(),
    chat: ref<PanelImperativeHandle>()
  }
  readonly groups = {
    workspace: ref<GroupImperativeHandle>(),
    dock: ref<GroupImperativeHandle>(),
    main: ref<GroupImperativeHandle>()
  }
  readonly workspaceDefaults = { workbench: 76, 'view-output': 24 }
  readonly mainDefaults = { 'view-editor': 50, 'view-preview': 50 }
  readonly initialLayouts: { workspace: Layout; dock: Layout; main: Layout }
  private geometry: { dock: number[]; split: number[]; rows: number[] }
  private persist?: (query: PanelQuery) => void
  private visible: Visibility
  private viewportNarrow: boolean
  private listeners = new Set<() => void>()
  constructor(
    readonly narrow = false,
    query?: PanelQuery
  ) {
    this.viewportNarrow = narrow
    this.geometry = this.resolve(query)
    this.initialLayouts = this.layouts(this.geometry)
    this.visible = {
      files: this.geometry.dock[0] > 0,
      editor: this.geometry.split[0] > 0,
      preview: this.geometry.split[1] > 0,
      output: this.geometry.rows[1] > 0,
      chat: this.geometry.dock[2] > 0
    }
  }
  dockDefaults = (narrow = this.narrow) => ({
    'view-files': narrow ? 0 : 14,
    center: narrow ? 100 : 86,
    'view-chat': 0
  })
  // Query defaults stay stable for this page; Reset follows the current screen.
  setNarrow = (narrow: boolean) => {
    this.viewportNarrow = narrow
  }
  getSnapshot = () => this.visible
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  sync = (sizes: Layout) => {
    const round = (keys: string[]) => {
      const values = keys.map((key) => Math.round(sizes[key] * 100) / 100)
      values[values.length - 1] =
        Math.round((100 - values.slice(0, -1).reduce((sum, value) => sum + value, 0)) * 100) / 100
      return values
    }
    if ('center' in sizes) this.geometry.dock = round(['view-files', 'center', 'view-chat'])
    if ('view-editor' in sizes) this.geometry.split = round(['view-editor', 'view-preview'])
    if ('workbench' in sizes) this.geometry.rows = round(['workbench', 'view-output'])
    const next = { ...this.visible }
    let changed = false
    for (const { id } of paneDefinitions) {
      const key = 'view-' + id
      if (key in sizes && next[id] !== sizes[key] > 0) {
        next[id] = sizes[key] > 0
        changed = true
      }
    }
    if (changed) {
      this.visible = next
      for (const listener of this.listeners) listener()
    }
  }
  /** Persist settled changes, never every pixel of a pointer drag. */
  commit = () => {
    const defaults = this.resolve()
    this.persist?.({
      dock: sameSizes(this.geometry.dock, defaults.dock) ? null : this.geometry.dock,
      split: sameSizes(this.geometry.split, defaults.split) ? null : this.geometry.split,
      rows: sameSizes(this.geometry.rows, defaults.rows) ? null : this.geometry.rows
    })
  }
  connectPersistence = (persist: (query: PanelQuery) => void) => {
    this.persist = persist
    return () => {
      this.persist = undefined
    }
  }
  private resolve(query?: PanelQuery) {
    return {
      dock: query?.dock && query.dock[1] >= 35 ? query.dock : [this.narrow ? 0 : 14, this.narrow ? 100 : 86, 0],
      split: query?.split ?? [50, 50],
      rows: query?.rows && query.rows[0] >= 30 ? query.rows : [76, 24]
    }
  }
  private layouts(geometry: { dock: number[]; split: number[]; rows: number[] }) {
    return {
      dock: { 'view-files': geometry.dock[0], center: geometry.dock[1], 'view-chat': geometry.dock[2] },
      main: { 'view-editor': geometry.split[0], 'view-preview': geometry.split[1] },
      workspace: { workbench: geometry.rows[0], 'view-output': geometry.rows[1] }
    }
  }
  restore = (query: PanelQuery) => {
    const next = this.resolve(query)
    if (
      sameSizes(next.dock, this.geometry.dock) &&
      sameSizes(next.split, this.geometry.split) &&
      sameSizes(next.rows, this.geometry.rows)
    )
      return
    const layouts = this.layouts(next)
    this.groups.workspace.current?.setLayout(layouts.workspace)
    this.groups.dock.current?.setLayout(layouts.dock)
    this.groups.main.current?.setLayout(layouts.main)
  }
  canCollapse = (id: PaneId) => (id === 'editor' ? this.visible.preview : id === 'preview' ? this.visible.editor : true)
  collapse = (id: PaneId) => {
    if (this.canCollapse(id)) this.panels[id].current?.collapse()
  }
  expand = (id: PaneId) => this.panels[id].current?.expand()
  toggle = (id: PaneId) => (this.visible[id] ? this.collapse(id) : this.expand(id))
  reset = () => {
    this.groups.workspace.current?.setLayout(this.workspaceDefaults)
    this.groups.dock.current?.setLayout(this.dockDefaults(this.viewportNarrow))
    this.groups.main.current?.setLayout(this.mainDefaults)
  }
}
