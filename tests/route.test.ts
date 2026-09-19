import { expect, test } from 'bun:test';
import { pathOf, routeOf } from '../src/playground/route';

test('only the playground path opens the workspace; everything else is the landing page', () => {
  for (const pathname of ['/playground', '/playground/', '/playground//', '/Playground', '/PLAYGROUND']) {
    expect({ pathname, route: routeOf(pathname) }).toEqual({ pathname, route: 'playground' });
  }
  for (const pathname of ['/', '', '/playgrounds', '/playground/nested', '/play', '/landing', '/x']) {
    expect({ pathname, route: routeOf(pathname) }).toEqual({ pathname, route: 'landing' });
  }
});

test('routes round-trip through their paths', () => {
  expect(pathOf('landing')).toBe('/');
  expect(pathOf('playground')).toBe('/playground');
  expect(routeOf(pathOf('landing'))).toBe('landing');
  expect(routeOf(pathOf('playground'))).toBe('playground');
});
