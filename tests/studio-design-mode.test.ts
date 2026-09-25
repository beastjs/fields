import { expect, test } from 'bun:test';
import { init } from 'es-module-lexer';
import { compileProject } from '../src/playground/compiler';
import { helloWorld } from '../src/playground/examples';
import { addSection, blockDocument, blockSource, pagePreviewProject, planPageInstall, readNodeId, readPage, sectionFile, STUDIO_STYLESHEET } from '../src/playground/studio/page';
import { applyOverrides, clearNodeOverride, mergeStyle, overrideCount, setNodeOverride } from '../src/playground/studio/ir/overrides';
import { toClasses, toStyle } from '../src/playground/studio/ir/classes';
import { nodeIndex } from '../src/playground/studio/ir/render';
import type { NodeOverride } from '../src/playground/studio/ir/types';
import { builtInPresets } from './built-in-presets';

const presets = builtInPresets;

test('layout edits to a hand-written section are installed even without a preset', () => {
  const source = "section(className='p-4' data-section='hero')\n  h1(className='p-2') Inspector example\n";
  const project = { ...helloWorld, files: { ...helloWorld.files,
    '/src/Page.btsx': "import Hero from './sections/Hero.btsx'\n\nmain(data-page)\n  Hero\n",
    '/src/sections/Hero.btsx': source,
    '/src/style.css': STUDIO_STYLESHEET,
  } };
  const block = readPage(project, presets)[0];
  expect(block.presetId).toBeUndefined();
  const node = [...nodeIndex(blockDocument(project, block, presets)!).values()].find(node => node.type === 'element' && node.tag === 'h1')!;
  const edited = { ...block, overrides: setNodeOverride(undefined, node.id, { style: { spacing: { pt: 2.25 } } }) };
  const install = planPageInstall(project, [edited], presets);
  expect(install.files['/src/sections/Hero.btsx']).toContain('pt-2.25');
  expect(install.files['/src/sections/Hero.btsx']).toContain('Inspector example');
  expect(planPageInstall(project, [block], presets).files['/src/sections/Hero.btsx']).toBeUndefined();
});
const blockOf = (presetId: string, overrides?: Record<string, NodeOverride>) => {
  const { blocks } = addSection([], presetId, presets);
  return { ...blocks[0], overrides };
};

test('merging a style patch replaces fields within a group and leaves the rest alone', () => {
  const base = toStyle('flex px-6 py-16 max-w-4xl rounded-3xl bg-current/5');
  const merged = mergeStyle(base, { spacing: { py: 24 } })!;
  expect(merged.spacing).toEqual({ px: 6, py: 24 });
  expect(merged.size).toEqual({ maxW: '4xl' });
  expect(merged.raw).toEqual(['bg-current/5']);
  // A null clears one field without disturbing its neighbours.
  expect(mergeStyle(base, { spacing: { px: null as unknown as number } })!.spacing).toEqual({ py: 16 });
});

test('a per-breakpoint patch merges into that breakpoint only', () => {
  const base = toStyle('px-4 py-20 sm:py-24');
  const merged = mergeStyle(base, { at: { sm: { spacing: { py: 32 } } } })!;
  expect(merged.spacing).toEqual({ px: 4, py: 20 });
  expect(merged.at).toEqual({ sm: { spacing: { py: 32 } } });
  expect(toClasses(merged)).toBe('px-4 py-20 sm:py-32');
});

test('applying an override leaves the preset document untouched', () => {
  const document = presets.document('cta-default')!;
  const before = JSON.stringify(document);
  const rootId = document.root.id;

  const patched = applyOverrides(document, { [rootId]: { style: { spacing: { py: 40 } } } });
  expect(toClasses(nodeIndex(patched).get(rootId)!.type === 'element' ? (nodeIndex(patched).get(rootId) as { style?: object }).style : undefined)).toContain('py-40');
  // The shared preset is never mutated; that is what makes an edit safe to make and to undo.
  expect(JSON.stringify(document)).toBe(before);
  expect(applyOverrides(document, {})).toBe(document);
  expect(applyOverrides(document, undefined)).toBe(document);
});

test('an override that patches nothing is dropped rather than stored', () => {
  const withEdit = setNodeOverride(undefined, 'n1', { style: { spacing: { py: 40 } } });
  expect(overrideCount(withEdit)).toBe(1);

  // A second edit to the same node merges into the first.
  const merged = setNodeOverride(withEdit, 'n1', { style: { spacing: { px: 8 } } });
  expect(merged.n1.style?.spacing).toEqual({ py: 40, px: 8 });

  expect(overrideCount(setNodeOverride(undefined, 'n1', { style: {} }))).toBe(0);
  expect(overrideCount(clearNodeOverride(merged, 'n1'))).toBe(0);
  expect(clearNodeOverride(undefined, 'n1')).toEqual({});
});

test('a block renders its overrides, and clearing them restores the preset byte for byte', () => {
  const clean = blockOf('cta-default');
  const original = blockSource(helloWorld, clean, presets);
  const rootId = presets.document('cta-default')!.root.id;

  const edited = blockOf('cta-default', { [rootId]: { style: { spacing: { py: 40 } } } });
  const source = blockSource(helloWorld, edited, presets);
  expect(source).toContain('py-40');
  expect(source).not.toBe(original);
  expect(blockSource(helloWorld, blockOf('cta-default', {}), presets)).toBe(original);
});

test('editing text replaces only that node\'s words', () => {
  const document = presets.document('cta-default')!;
  const heading = [...nodeIndex(document).values()].find(node => node.type === 'element' && node.tag === 'h2')!;
  const edited = blockOf('cta-default', { [heading.id]: { text: [{ kind: 'literal', value: 'Ship it today' }] } });
  const source = blockSource(helloWorld, edited, presets);
  expect(source).toContain('Ship it today');
  expect(source).not.toContain('Start building in the next five minutes');
  // Everything else is still the preset's.
  expect(source).toContain('Free forever for solo projects.');
});

test('only the preview is inspectable; an install never carries node ids', async () => {
  await init();
  const { blocks, name } = addSection([], 'cta-default', presets);

  const inspectable = pagePreviewProject(helloWorld, blocks, presets, true);
  expect(inspectable.files[sectionFile(name)]).toContain("data-node='");
  // The ids must survive compilation, since Design Mode hit-tests on them in the running page.
  expect((await compileProject(inspectable)).diagnostics).toEqual([]);

  expect(pagePreviewProject(helloWorld, blocks, presets).files[sectionFile(name)]).not.toContain('data-node');
  expect(planPageInstall(helloWorld, blocks, presets).files[sectionFile(name)]).not.toContain('data-node');
});

test('an installed section can be edited again, because its file parses back to the same nodes', () => {
  const rootId = presets.document('hero-default')!.root.id;
  const edited = blockOf('hero-default', { [rootId]: { style: { spacing: { py: 40 } } } });
  const install = planPageInstall(helloWorld, [edited], presets);
  const project = { ...helloWorld, files: { ...helloWorld.files, ...install.files } };

  // Reading the page back marks it edited, since the file no longer matches the preset.
  const reopened = { name: edited.name, kind: edited.kind, presetId: 'hero-default', edited: true };
  const document = blockDocument(project, reopened, presets)!;
  expect(document).toBeDefined();
  // Same node ids, so a fresh override lands on the node the person clicks.
  expect([...nodeIndex(document).keys()]).toEqual([...nodeIndex(presets.document('hero-default')!).keys()]);
  expect(toClasses((document.root as { style?: never }).style)).toContain('py-40');
});

test('a hand-written section the parser cannot read simply is not editable', () => {
  const project = { ...helloWorld, files: { ...helloWorld.files, '/src/sections/Hero.btsx': 'section(data-section=\'hero\'\n' } };
  const block = { name: 'Hero', kind: 'hero' as const, edited: true };
  expect(blockDocument(project, block, presets)).toBeUndefined();
});

test('stamped ids name their block, so two sections never share a node id', () => {
  // Node ids are unique within a preset but not across a page: without a prefix, `n3` names a node in every
  // section and an edit made in one would silently restyle the others.
  let page = addSection([], 'hero-default', presets).blocks;
  page = addSection(page, 'cta-default', presets).blocks;
  page = addSection(page, 'hero-centered', presets).blocks;

  const files = pagePreviewProject(helloWorld, page, presets, true).files;
  const stamped = page.flatMap(block => [...files[sectionFile(block.name)].matchAll(/data-node='([^']+)'/g)].map(match => match[1]));
  expect(new Set(stamped).size).toBe(stamped.length);

  for (const id of stamped) {
    const owner = readNodeId(id)!;
    expect(page.some(block => block.name === owner.name)).toBe(true);
  }
  // Two heroes on one page get separate namespaces even though they share node ids.
  expect(stamped).toContain('Hero:n1');
  expect(stamped).toContain('Hero2:n1');
});

test('reading a stamped id rejects anything that is not block:node', () => {
  expect(readNodeId('Hero:n3')).toEqual({ name: 'Hero', nodeId: 'n3' });
  expect(readNodeId('n3')).toBeUndefined();
  expect(readNodeId(':n3')).toBeUndefined();
  expect(readNodeId('Hero:')).toBeUndefined();
});
