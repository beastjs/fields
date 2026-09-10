import { createParser } from '@octanejs/nuqs/server';

export interface PanelQuery { dock: number[] | null; split: number[] | null; rows: number[] | null }
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
export const panelQueryParsers = { dock: percentageParser(3), split: percentageParser(2), rows: percentageParser(2) };
