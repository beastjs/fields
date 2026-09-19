import { expect, test } from 'bun:test';
import { compileProject } from '../src/playground/compiler';
import { helloWorld } from '../src/playground/examples';
import { sectionTemplates } from '../src/playground/studio/catalog';
import { addSection, pagePreviewProject, sectionFile } from '../src/playground/studio/page';
import { builtInPresets } from './built-in-presets';
import { toClasses, toStyle } from '../src/playground/studio/ir/classes';
import { parsePreset } from '../src/playground/studio/ir/parse';
import { nodeIndex, renderPreset, walk } from '../src/playground/studio/ir/render';
import { MAX_STORED_DEPTH, depthOf, flattenPreset, inflatePreset, type StoredPreset } from '../src/playground/studio/ir/storage';
import { parseStoredPreset } from '../src/playground/studio/ir/schema';
import type { SectionTemplate } from '../src/playground/studio/types';

const documentOf = (template: SectionTemplate) =>
  parsePreset(template.source, { id: template.id, kind: template.kind, title: template.title, description: template.description, wireframe: template.wireframe });

/** Sorts the tokens inside every `className`, so the renderer's canonical ordering is not read as a difference. */
const sortClasses = (source: string) =>
  source
    .replace(/className=(['"])(.*?)\1/g, (_, quote, value) => `className=${quote}${value.split(/\s+/).filter(Boolean).sort().join(' ')}${quote}`)
    .replace(/className=\{'(.*?) ' \+ /g, (_, value) => `className={'${value.split(/\s+/).filter(Boolean).sort().join(' ')} ' + `);

test('every section template parses and renders back to the same source', () => {
  for (const template of sectionTemplates) {
    const rendered = renderPreset(documentOf(template));
    // Class order is canonicalised; nothing else about the source may change, and no utility may be lost or invented.
    expect({ id: template.id, source: sortClasses(rendered) }).toEqual({ id: template.id, source: sortClasses(template.source) });
  }
});

test('parsing is idempotent, so a document survives any number of install round-trips', () => {
  for (const template of sectionTemplates) {
    const once = documentOf(template);
    const twice = parsePreset(renderPreset(once), { id: once.id, kind: once.kind, title: once.title, description: once.description, wireframe: once.wireframe });
    expect({ id: template.id, document: twice }).toEqual({ id: template.id, document: once });
  }
});

test('node ids are unique within a document and stable across parses', () => {
  for (const template of sectionTemplates) {
    const ids = [...walk(documentOf(template).root)].map(node => node.id);
    expect({ id: template.id, unique: new Set(ids).size }).toEqual({ id: template.id, unique: ids.length });
    expect({ id: template.id, ids: [...walk(documentOf(template).root)].map(node => node.id) }).toEqual({ id: template.id, ids });
  }
});

test('rendered sections still compile as part of a page', async () => {
  for (const template of sectionTemplates) {
    const { blocks, name } = addSection([], template.id, builtInPresets);
    const project = pagePreviewProject(helloWorld, blocks, builtInPresets);
    project.files[sectionFile(name)] = renderPreset(documentOf(template));
    const result = await compileProject(project);
    expect({ id: template.id, diagnostics: result.diagnostics }).toEqual({ id: template.id, diagnostics: [] });
  }
});

test('an inspectable render stamps every element with the node id Design Mode addresses it by', () => {
  const template = sectionTemplates.find(candidate => candidate.id === 'cta-default')!;
  const document = documentOf(template);
  const rendered = renderPreset(document, { inspectable: true });
  const stamped = [...rendered.matchAll(/data-node='(n\d+)'/g)].map(match => match[1]);
  const elements = [...walk(document.root)].filter(node => node.type === 'element').map(node => node.id);
  expect(stamped).toEqual(elements);
  expect(nodeIndex(document).get(stamped[0])).toBe(document.root);
  // The install output carries no inspection attributes.
  expect(renderPreset(document)).not.toContain('data-node');
});

test('the class model classifies what Design Mode edits and keeps everything else verbatim', () => {
  const style = toStyle('relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-current/15 px-6 py-16 text-center sm:px-16 hover:bg-current/5');
  expect(style.position).toEqual({ position: 'relative' });
  expect(style.spacing).toEqual({ mx: 'auto', px: 6, py: 16 });
  expect(style.size).toEqual({ maxW: '4xl' });
  expect(style.surface).toEqual({ radius: '3xl', border: 'DEFAULT' });
  expect(style.text).toEqual({ align: 'center' });
  // A colour, an overflow and a state variant are not modelled, so they survive in source order.
  expect(style.raw).toEqual(['overflow-hidden', 'border-current/15', 'hover:bg-current/5']);
  // Only a leading breakpoint routes to `at`.
  expect(style.at).toEqual({ sm: { spacing: { px: 16 } } });
});

test('lengths, negatives, arbitrary values and multi-segment prefixes survive both directions', () => {
  for (const classes of ['gap-x-6 gap-y-2', '-mt-4 lg:-mt-8', 'max-w-[42rem] min-h-screen size-7', 'grid grid-cols-3 items-start justify-between', 'w-1/2 h-px basis-0 grow shrink-0', 'leading-[1.75] tracking-tight text-5xl font-semibold text-balance']) {
    expect(toClasses(toStyle(classes)).split(' ').sort()).toEqual(classes.split(' ').sort());
  }
});

test('a conditional class list keeps its static part typed and its condition verbatim', () => {
  const style = toStyle('flex flex-col gap-6 rounded-3xl border p-8', "(plan.featured ? 'border-current/30 bg-current/10' : 'border-current/10')");
  expect(style.layout).toEqual({ display: 'flex', direction: 'col' });
  expect(style.spacing).toEqual({ p: 8, gap: 6 });
  expect(style.dyn).toBe("(plan.featured ? 'border-current/30 bg-current/10' : 'border-current/10')");
});

test('flattening and inflating a preset are exact inverses', () => {
  for (const template of sectionTemplates) {
    const document = documentOf(template);
    expect({ id: template.id, document: inflatePreset(flattenPreset(document)) }).toEqual({ id: template.id, document });
  }
});

test('every stored preset fits inside Convex\'s nesting limit, whatever its tree depth', () => {
  for (const template of sectionTemplates) {
    const stored = flattenPreset(documentOf(template));
    // Two levels of headroom for the argument wrapper a mutation adds around the document.
    expect({ id: template.id, withinLimit: depthOf(stored) <= MAX_STORED_DEPTH - 2 }).toEqual({ id: template.id, withinLimit: true });
    // The flat form is what crosses the boundary, so it must satisfy the schema after a JSON round-trip.
    expect(() => parseStoredPreset(JSON.parse(JSON.stringify(stored)))).not.toThrow();
  }
});

test('a stored preset is flat regardless of how deep the section nests', () => {
  const deepest = sectionTemplates
    .map(template => ({ id: template.id, tree: depthOf(documentOf(template)), stored: depthOf(flattenPreset(documentOf(template))) }))
    .sort((a, b) => b.tree - a.tree)[0];
  // The tree form would have blown the limit; the flat form does not grow with it.
  expect(deepest.tree).toBeGreaterThan(MAX_STORED_DEPTH);
  expect(deepest.stored).toBeLessThanOrEqual(MAX_STORED_DEPTH - 2);
});

test('inflating rejects a preset that is not a single connected tree', () => {
  const stored = flattenPreset(documentOf(sectionTemplates.find(candidate => candidate.id === 'cta-default')!));
  const withNodes = (nodes: StoredPreset['nodes']) => ({ ...stored, nodes });

  expect(() => inflatePreset(withNodes(stored.nodes.slice(1)))).toThrow(/exactly one root/);
  // A node whose parent is missing can never be reached from the root.
  const orphaned = stored.nodes.map(node => (node.id === stored.nodes[2].id ? { ...node, parent: 'nope' } : node));
  expect(() => inflatePreset(withNodes(orphaned))).toThrow(/unreachable/);
});

/** Convex normalises object key order, so a stored preset must never encode order in its keys. */
const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as object).sort().map(key => [key, sortKeys((value as Record<string, unknown>)[key])]));
  }
  return value;
};

test('a stored preset survives having every object key reordered, as the backend returns it', () => {
  for (const template of sectionTemplates) {
    const document = documentOf(template);
    const returned = parseStoredPreset(sortKeys(JSON.parse(JSON.stringify(flattenPreset(document)))));
    // Attribute order is the one thing a record would have lost: `data-section` must still precede `className`.
    expect({ id: template.id, source: renderPreset(inflatePreset(returned)) }).toEqual({ id: template.id, source: renderPreset(document) });
  }
});
