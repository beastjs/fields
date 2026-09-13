import type { GroupImperativeHandle, Layout, PanelImperativeHandle } from '@octanejs/resizable-panels'
import { sameSizes, type PanelQuery } from './panel-query'
import { isWorkbenchPaneId, paneDefinitions, workbenchPaneIds } from './panes'
import type { PaneId, WorkbenchPaneId } from './panes'

export { paneDefinitions }
export type { PaneId, WorkbenchPaneId }

type Visibility = Record<PaneId, boolean>
type LayoutSnapshot = Visibility & { order: readonly WorkbenchPaneId[]; draggingEnabled: boolean }
type Geometry = { panes: number[]; rows: number[] }
type PaneSizes = Record<WorkbenchPaneId, number>

const ref = <T>() => ({ current: null as T | null })
const sameOrder = (a: readonly WorkbenchPaneId[], b: readonly WorkbenchPaneId[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])
const copyDefaultOrder = () => [...workbenchPaneIds]
const defaultSizes = (narrow: boolean): PaneSizes => ({
  files: narrow ? 0 : 14,
  editor: narrow ? 50 : 43,
  preview: narrow ? 50 : 43,
  chat: 0,
})
const draggingPreferenceKey = 'beast-playground.pane-dragging.v1'
const readDraggingPreference = () => {
  if (typeof localStorage === 'undefined') return true
  try { return localStorage.getItem(draggingPreferenceKey) !== 'disabled' }
  catch { return true }
}
const saveDraggingPreference = (enabled: boolean) => {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(draggingPreferenceKey, enabled ? 'enabled' : 'disabled') }
  catch { /* The toggle still works for this tab. */ }
}

/** Layout owns pane geometry and ordering only. Project and runtime lifetimes are independent. */
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
    dock: ref<GroupImperativeHandle>()
  }
  readonly workspaceDefaults = { workbench: 76, 'view-output': 24 }
  readonly initialLayouts: { workspace: Layout; dock: Layout }
  private geometry: Geometry
  private order: WorkbenchPaneId[]
  private persist?: (query: PanelQuery) => void
  private snapshot: LayoutSnapshot
  private viewportNarrow: boolean
  private draggingEnabled = readDraggingPreference()
  private expandedPaneSizes: Partial<Record<WorkbenchPaneId, number>> = {}
  private listeners = new Set<() => void>()

  constructor(
    readonly narrow = false,
    query?: PanelQuery
  ) {
    this.viewportNarrow = narrow
    this.order = this.resolveOrder(query?.order)
    this.geometry = this.resolve(query, this.order)
    this.initialLayouts = this.layouts(this.geometry, this.order)
    this.snapshot = this.createSnapshot(this.geometry, this.order)
  }

  setNarrow = (narrow: boolean) => {
    this.viewportNarrow = narrow
  }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  currentDockLayout = () => this.layouts(this.geometry, this.order).dock
  setDraggingEnabled = (enabled: boolean) => {
    if (enabled === this.draggingEnabled) return
    this.draggingEnabled = enabled
    saveDraggingPreference(enabled)
    this.publish(this.createSnapshot(this.geometry, this.order))
  }
  toggleDragging = () => this.setDraggingEnabled(!this.draggingEnabled)

  sync = (sizes: Layout) => {
    const round = (values: number[]) => {
      const rounded = values.map((value) => Math.round(value * 100) / 100)
      rounded[rounded.length - 1] =
        Math.round((100 - rounded.slice(0, -1).reduce((sum, value) => sum + value, 0)) * 100) / 100
      return rounded
    }
    if (this.order.some((id) => 'view-' + id in sizes)) {
      this.geometry.panes = round(this.order.map((id) => sizes['view-' + id]))
    }
    if ('workbench' in sizes) this.geometry.rows = round([sizes.workbench, sizes['view-output']])

    const next = this.createSnapshot(this.geometry, this.order)
    if (paneDefinitions.some(({ id }) => next[id] !== this.snapshot[id])) this.publish(next)
  }

  /** Persist settled changes, never every pixel of a pointer drag. */
  commit = () => {
    const defaults = this.resolve(undefined, this.order)
    this.persist?.({
      dock: null,
      split: null,
      panes: sameSizes(this.geometry.panes, defaults.panes) ? null : this.geometry.panes,
      rows: sameSizes(this.geometry.rows, defaults.rows) ? null : this.geometry.rows,
      order: sameOrder(this.order, workbenchPaneIds) ? null : [...this.order]
    })
  }
  connectPersistence = (persist: (query: PanelQuery) => void) => {
    this.persist = persist
    return () => {
      this.persist = undefined
    }
  }

  reorder = (id: WorkbenchPaneId, target: WorkbenchPaneId) => {
    const from = this.order.indexOf(id)
    const to = this.order.indexOf(target)
    if (from < 0 || to < 0 || from === to) return

    const next = [...this.order]
    next.splice(from, 1)
    next.splice(to, 0, id)
    this.setOrder(next)
  }
  setOrder = (nextOrder: readonly WorkbenchPaneId[]) => {
    if (!this.draggingEnabled || sameOrder(nextOrder, this.order)) return
    if (nextOrder.length !== workbenchPaneIds.length || new Set(nextOrder).size !== workbenchPaneIds.length) return
    const sizes = this.sizesByPane()
    this.order = [...nextOrder]
    this.geometry.panes = this.order.map((pane) => sizes[pane])
    this.publish(this.createSnapshot(this.geometry, this.order))
    this.commit()
  }
  move = (id: WorkbenchPaneId, delta: -1 | 1) => {
    const index = this.order.indexOf(id)
    const target = this.order[index + delta]
    if (target) this.reorder(id, target)
  }

  restore = (query: PanelQuery) => {
    const nextOrder = this.resolveOrder(query.order)
    const next = this.resolve(query, nextOrder)
    const orderChanged = !sameOrder(nextOrder, this.order)
    const panesChanged = !sameSizes(next.panes, this.geometry.panes)
    const rowsChanged = !sameSizes(next.rows, this.geometry.rows)
    if (!orderChanged && !panesChanged && !rowsChanged) return

    this.order = nextOrder
    this.geometry = next
    this.publish(this.createSnapshot(next, nextOrder))
    if (!orderChanged && panesChanged) this.groups.dock.current?.setLayout(this.layouts(next, nextOrder).dock)
    if (rowsChanged) this.groups.workspace.current?.setLayout(this.layouts(next, nextOrder).workspace)
  }

  canCollapse = (id: PaneId) =>
    !isWorkbenchPaneId(id) || this.order.some((pane) => pane !== id && this.snapshot[pane])
  collapse = (id: PaneId) => {
    if (!this.canCollapse(id)) return
    if (!isWorkbenchPaneId(id)) {
      this.panels[id].current?.collapse()
      return
    }

    const index = this.order.indexOf(id)
    const size = this.geometry.panes[index]
    if (!size) return
    this.expandedPaneSizes[id] = size
    const remaining = 100 - size
    this.setPaneSizes(this.geometry.panes.map((value, paneIndex) =>
      paneIndex === index ? 0 : value > 0 ? value / remaining * 100 : 0
    ))
  }
  expand = (id: PaneId) => {
    if (!isWorkbenchPaneId(id)) {
      this.panels[id].current?.expand()
      return
    }

    const index = this.order.indexOf(id)
    if (this.geometry.panes[index] > 0) return
    const fallback = id === 'files' ? (this.viewportNarrow ? 20 : 9)
      : id === 'chat' ? (this.viewportNarrow ? 45 : 24)
      : 20
    const size = Math.min(this.expandedPaneSizes[id] ?? fallback, 80)
    this.setPaneSizes(this.geometry.panes.map((value, paneIndex) =>
      paneIndex === index ? size : value > 0 ? value * (100 - size) / 100 : 0
    ))
  }
  toggle = (id: PaneId) => (this.snapshot[id] ? this.collapse(id) : this.expand(id))
  reset = () => {
    const nextOrder = copyDefaultOrder()
    const orderChanged = !sameOrder(this.order, nextOrder)
    this.order = nextOrder
    this.expandedPaneSizes = {}
    this.geometry = {
      panes: this.sizesForOrder(defaultSizes(this.viewportNarrow), nextOrder),
      rows: [this.workspaceDefaults.workbench, this.workspaceDefaults['view-output']]
    }
    this.publish(this.createSnapshot(this.geometry, this.order))
    if (!orderChanged) this.groups.dock.current?.setLayout(this.layouts(this.geometry, this.order).dock)
    this.groups.workspace.current?.setLayout(this.workspaceDefaults)
    this.commit()
  }

  private publish(next: LayoutSnapshot) {
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
  private setPaneSizes(sizes: number[]) {
    this.geometry.panes = sizes
    this.publish(this.createSnapshot(this.geometry, this.order))
    this.groups.dock.current?.setLayout(this.layouts(this.geometry, this.order).dock)
    this.commit()
  }
  private resolveOrder(order?: readonly WorkbenchPaneId[] | null) {
    return order && order.length === workbenchPaneIds.length && new Set(order).size === workbenchPaneIds.length
      ? [...order]
      : copyDefaultOrder()
  }
  private resolve(query: PanelQuery | undefined, order: readonly WorkbenchPaneId[]): Geometry {
    if (query?.panes) {
      return {
        panes: [...query.panes],
        rows: query.rows && query.rows[0] >= 30 ? [...query.rows] : [76, 24]
      }
    }

    const dock = query?.dock && query.dock[1] >= 35
      ? query.dock
      : [this.narrow ? 0 : 14, this.narrow ? 100 : 86, 0]
    const split = query?.split ?? [50, 50]
    const sizes: PaneSizes = {
      files: dock[0],
      editor: dock[1] * split[0] / 100,
      preview: dock[1] * split[1] / 100,
      chat: dock[2]
    }
    return {
      panes: this.sizesForOrder(sizes, order),
      rows: query?.rows && query.rows[0] >= 30 ? [...query.rows] : [76, 24]
    }
  }
  private sizesByPane(): PaneSizes {
    const sizes = {} as PaneSizes
    this.order.forEach((id, index) => { sizes[id] = this.geometry.panes[index] })
    return sizes
  }
  private sizesForOrder(sizes: PaneSizes, order: readonly WorkbenchPaneId[]) {
    return order.map((id) => sizes[id])
  }
  private layouts(geometry: Geometry, order: readonly WorkbenchPaneId[]) {
    const dock: Layout = {}
    order.forEach((id, index) => { dock['view-' + id] = geometry.panes[index] })
    return {
      dock,
      workspace: { workbench: geometry.rows[0], 'view-output': geometry.rows[1] }
    }
  }
  private createSnapshot(geometry: Geometry, order: readonly WorkbenchPaneId[]): LayoutSnapshot {
    const visible = {
      files: false,
      editor: false,
      preview: false,
      output: geometry.rows[1] > 0,
      chat: false
    }
    order.forEach((id, index) => { visible[id] = geometry.panes[index] > 0 })
    return { ...visible, order, draggingEnabled: this.draggingEnabled }
  }
}
