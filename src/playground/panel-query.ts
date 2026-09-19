import { createParser, parseAsNumberLiteral, parseAsStringLiteral } from '@octanejs/nuqs/server';
import { isWorkbenchPaneId, workbenchPaneIds } from './panes';
import type { WorkbenchPaneId } from './panes';
import type { PreviewWidth } from './project-storage';

export interface PanelQuery {
  dock: number[] | null
  split: number[] | null
  rows: number[] | null
  panes: number[] | null
  order: WorkbenchPaneId[] | null
}
export const sameSizes = (a: number[], b: number[]) => a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) < 0.03);
export function percentageParser(length: number) {
  return createParser({
    parse(value: string) {
      if (!/^\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?)*$/.test(value)) return null;
      const sizes = value.split(',').map(Number);
      return sizes.length === length && sizes.every(size => Number.isFinite(size) && size >= 0 && size <= 100)
        && Math.abs(sizes.reduce((sum, size) => sum + size, 0) - 100) < 0.03 ? sizes : null;
    },
    serialize: (sizes: number[]) => sizes.join(','),
    eq: sameSizes,
  });
}
export const paneOrderParser = createParser({
  parse(value: string) {
    const ids = value.split(',');
    return ids.length === workbenchPaneIds.length && new Set(ids).size === workbenchPaneIds.length && ids.every(isWorkbenchPaneId)
      ? ids as WorkbenchPaneId[]
      : null;
  },
  serialize: (order: WorkbenchPaneId[]) => order.join(','),
  eq: (a: WorkbenchPaneId[], b: WorkbenchPaneId[]) => a.every((id, index) => id === b[index]),
});
export const panelQueryParsers = {
  dock: percentageParser(3),
  split: percentageParser(2),
  rows: percentageParser(2),
  panes: percentageParser(4),
  order: paneOrderParser,
};

/** Preview toolbar state. Both are nullable: an absent param means "use the default". */
export const previewWidths = ['100%', '768px', '375px'] as const satisfies readonly PreviewWidth[];
export const previewZooms = [50, 67, 75, 80, 90, 100, 110, 125, 150] as const;
export const defaultPreviewZoom = 75;
export const previewQueryParsers = {
  preview: parseAsStringLiteral(previewWidths),
  zoom: parseAsNumberLiteral(previewZooms),
};
