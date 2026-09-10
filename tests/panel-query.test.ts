import { expect, test } from 'bun:test';
import { panelQueryParsers, percentageParser, sameSizes } from '../src/playground/panel-query';

test('layout parsers preserve zero-size collapse and proportional sizes', () => {
  expect(panelQueryParsers.dock.parse('0,75,25')).toEqual([0, 75, 25]);
  expect(panelQueryParsers.split.parse('62.75,37.25')).toEqual([62.75, 37.25]);
  expect(panelQueryParsers.rows.parse('100,0')).toEqual([100, 0]);
  expect(panelQueryParsers.dock.serialize([14, 68, 18])).toBe('14,68,18');
  expect(sameSizes([50, 50], [50.001, 49.999])).toBe(true);
});

test('invalid URL layouts fall back instead of producing unusable groups', () => {
  const parser = percentageParser(2);
  for (const invalid of ['NaN,100', '-1,101', '200,0', '0,0', '50', '50,25,25', '100,', '50.5,50.5', 'Infinity,0', '<script>']) expect(parser.parse(invalid)).toBeNull();
});
