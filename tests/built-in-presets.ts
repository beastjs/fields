import { pageRecipes, sectionTemplates } from '../src/playground/studio/catalog'
import { sectionKind } from '../src/playground/studio/kinds'
import { parsePreset } from '../src/playground/studio/ir/parse'
import { presetLookup } from '../src/playground/studio/presets'
import type { PresetRecipe, PresetSummary } from '../src/playground/studio/presets'
import type { SectionTemplate } from '../src/playground/studio/types'

/**
 * A preset lookup over the built-in templates, standing in for the seeded Convex catalog.
 *
 * Tests exercise page composition against the same documents the seed script pushes, without needing a deployment.
 * `scripts/seed-presets.ts` derives its payload the same way, so the two cannot drift.
 */
export const documentOf = (template: SectionTemplate) =>
  parsePreset(template.source, {
    id: template.id,
    kind: template.kind,
    title: template.title,
    description: template.description,
    wireframe: template.wireframe
  })

const summaryOf = (template: SectionTemplate): PresetSummary => ({
  presetId: template.id,
  kind: template.kind,
  title: template.title,
  description: template.description,
  wireframe: template.wireframe,
  keywords: sectionKind(template.kind).keywords,
  version: 1
})

export const builtInPresets = presetLookup(sectionTemplates.map(summaryOf), sectionTemplates.map(documentOf))

export const builtInRecipes: PresetRecipe[] = pageRecipes.map(recipe => ({
  recipeId: recipe.id,
  title: recipe.title,
  description: recipe.description,
  presetIds: recipe.templates
}))
