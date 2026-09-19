import { applyOverrides } from './ir/overrides'
import { renderPreset } from './ir/render'
import { inflatePreset } from './ir/storage'
import { sectionKinds } from './kinds'
import type { StoredPreset } from './ir/storage'
import type { NodeOverride, PresetDocument } from './ir/types'
import type { SectionKindId } from './types'

/**
 * The studio's view of the preset catalog.
 *
 * Presets live in Convex, but composing and installing a page is synchronous: `page.ts` needs a section's source to
 * diff it against the project, and the preview needs every block resolved before it can build. So the studio loads
 * the documents it references and hands the rest of the code this lookup, which answers from what is loaded and
 * says plainly when it is not.
 *
 * Summaries drive the library — they carry the wireframe and the words, and nothing there needs a tree. Documents
 * are fetched only for presets a page actually uses.
 */

export interface PresetSummary {
  presetId: string
  kind: SectionKindId
  title: string
  description: string
  wireframe: string[]
  keywords: string[]
  version: number
}

export interface PresetLookup {
  /** Every preset the catalog offers, for the library and for search. */
  summaries: PresetSummary[]
  summary(presetId: string): PresetSummary | undefined
  /** The preset's tree, once loaded. */
  document(presetId: string): PresetDocument | undefined
  /** The preset's `.btsx` source, once loaded, with any Design Mode overrides applied. */
  source(presetId: string, overrides?: Record<string, NodeOverride>): string | undefined
  /** True when every id given has a loaded document, so a page built from them can be composed and installed. */
  loaded(presetIds: string[]): boolean
}

const EMPTY: PresetSummary[] = []

/**
 * Builds a lookup from loaded catalog summaries and preset documents. Rendering is memoised per preset, since the
 * preview diffs a section's source on every rebuild.
 */
export function presetLookup(summaries: readonly PresetSummary[] = EMPTY, documents: readonly PresetDocument[] = []): PresetLookup {
  const byId = new Map(summaries.map(summary => [summary.presetId, summary]))
  const trees = new Map(documents.map(document => [document.id, document]))
  const rendered = new Map<string, string>()
  // Overridden renders are cached against the override object itself, which a Design Mode edit replaces wholesale.
  const overridden = new WeakMap<object, Map<string, string>>()

  return {
    summaries: [...summaries],
    summary: presetId => byId.get(presetId),
    document: presetId => trees.get(presetId),
    source: (presetId, overrides) => {
      const document = trees.get(presetId)
      if (!document) return undefined
      if (!overrides || !Object.keys(overrides).length) {
        const cached = rendered.get(presetId)
        if (cached !== undefined) return cached
        const source = renderPreset(document)
        rendered.set(presetId, source)
        return source
      }
      let byPreset = overridden.get(overrides)
      if (!byPreset) overridden.set(overrides, (byPreset = new Map()))
      const cached = byPreset.get(presetId)
      if (cached !== undefined) return cached
      const source = renderPreset(applyOverrides(document, overrides))
      byPreset.set(presetId, source)
      return source
    },
    loaded: presetIds => presetIds.every(presetId => trees.has(presetId))
  }
}

/** A recipe as Convex returns it: an ordered list of presets to compose. */
export interface PresetRecipe {
  recipeId: string
  title: string
  description: string
  presetIds: string[]
}

/** Rebuilds the trees Convex returns in their flat form. */
export const inflateAll = (stored: readonly { document: unknown }[]): PresetDocument[] =>
  stored.map(row => inflatePreset(row.document as StoredPreset))

/** Presets whose kind, title, description, or keywords match every word of the query. */
export function searchPresets(summaries: readonly PresetSummary[], query: string, kindLabel: (kind: SectionKindId) => string): PresetSummary[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return [...summaries]
  return summaries.filter(summary => {
    const haystack = [kindLabel(summary.kind), summary.title, summary.description, ...summary.keywords].join(' ').toLowerCase()
    return words.every(word => haystack.includes(word))
  })
}

/**
 * The lookup for the current query results, rebuilt only when those results change.
 *
 * Convex hands back the same array until its value changes, so identity is a sound cache key. This matters:
 * the studio diffs every block's source against the project on each render, and rebuilding the lookup would throw
 * away the memoised renders and re-serialise every tree.
 */
let cached: { summaries: unknown; documents: unknown; lookup: PresetLookup } | undefined

type PresetSummaryRow = Omit<PresetSummary, 'kind'> & { kind: string }

const isPresetSummary = (summary: PresetSummaryRow): summary is PresetSummary =>
  sectionKinds.some(kind => kind.id === summary.kind)

export function presetsFor(summaries: readonly PresetSummaryRow[] | undefined, documents: readonly { document: unknown }[] | undefined): PresetLookup {
  if (cached && cached.summaries === summaries && cached.documents === documents) return cached.lookup
  // Convex stores `kind` as a string; only registered application kinds may enter the typed studio model.
  const lookup = presetLookup(summaries?.filter(isPresetSummary) ?? EMPTY, documents ? inflateAll(documents) : [])
  cached = { summaries, documents, lookup }
  return lookup
}
