/**
 * Converts the built-in section templates into preset documents and seeds them into Convex.
 *
 * The `.ts` templates under src/playground/studio/sections are the authoring source for the built-ins; Convex is
 * where the studio reads them from. Run this after changing a template, or against a fresh deployment:
 *
 *   bun run seed:presets              # parse, validate, and push to the configured deployment
 *   bun run seed:presets --dry-run    # parse and validate only, printing what would change
 *   bun run seed:presets --out <path> # write the documents to a file instead of pushing
 *   bun run seed:presets --prod       # push to the production deployment instead of dev
 *   bun run seed:presets --recipes-only # update recipes without rewriting presets or themes
 *
 * Presets go up in batches so each `convex run` argument stays well inside the shell's limit.
 */
import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { pageRecipes, sectionKind, sectionTemplates } from '../src/playground/studio/catalog'
import { parsePreset } from '../src/playground/studio/ir/parse'
import { renderPreset } from '../src/playground/studio/ir/render'
import { parseStoredPreset } from '../src/playground/studio/ir/schema'
import { MAX_STORED_DEPTH, depthOf, flattenPreset, inflatePreset } from '../src/playground/studio/ir/storage'
import type { SectionKindId } from '../src/playground/studio/types'
import { builtInThemes } from '../src/playground/studio/themes'

const BATCH = 5

const argument = (flag: string) => {
  const index = process.argv.indexOf(flag)
  return index > 0 ? process.argv[index + 1] : undefined
}
const dryRun = process.argv.includes('--dry-run')
const prod = process.argv.includes('--prod')
const out = argument('--out')
const recipesOnly = process.argv.includes('--recipes-only')

function build() {
  return sectionTemplates.map(template => {
    const kind = sectionKind(template.kind as SectionKindId)
    const document = parsePreset(template.source, {
      id: template.id,
      kind: template.kind,
      title: template.title,
      description: template.description,
      wireframe: template.wireframe
    })
    // Parsing must be lossless before anything is stored: the document, not the template, becomes the source.
    const rendered = renderPreset(document)
    const before = template.source.replace(/\s+/g, ' ').trim()
    const after = rendered.replace(/\s+/g, ' ').trim()
    if (before.length !== after.length) {
      throw new Error(`"${template.id}" did not round-trip: ${before.length} chars in, ${after.length} out.`)
    }
    // Stored flat: Convex refuses documents nested past 16 levels, which a node tree passes at about eight elements.
    const stored = parseStoredPreset(JSON.parse(JSON.stringify(flattenPreset(document))))
    const depth = depthOf(stored)
    if (depth > MAX_STORED_DEPTH - 2) throw new Error(`"${template.id}" nests ${depth} levels; the limit is ${MAX_STORED_DEPTH - 2}.`)
    if (renderPreset(inflatePreset(stored)) !== rendered) throw new Error(`"${template.id}" did not survive flattening.`)

    return {
      presetId: template.id,
      kind: template.kind,
      title: template.title,
      description: template.description,
      wireframe: template.wireframe,
      keywords: kind.keywords,
      document: stored
    }
  })
}

// The local binary rather than `npx`, which echoes every argument — and a batch of presets is 20 KB of them.
const convex = fileURLToPath(new URL('../node_modules/.bin/convex', import.meta.url))

function run(name: string, args: unknown) {
  const result = spawnSync(convex, ['run', ...(prod ? ['--prod'] : []), name, JSON.stringify(args)], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  if (result.status === 0) return result.stdout.trim()
  const detail = (result.stderr ?? '').trim()
  if (detail.includes('Could not find function')) {
    throw new Error(
      `The deployment has no "${name}" yet. Push the new schema and functions first:\n` +
      '  npx convex dev      # pushes and keeps watching\n' +
      '  npx convex deploy   # one-off push\n' +
      'Then run this again.'
    )
  }
  throw new Error(`convex run ${name} failed with status ${result.status}.\n${detail}`)
}

const presets = build()
const recipes = pageRecipes.map(recipe => ({ recipeId: recipe.id, title: recipe.title, description: recipe.description, presetIds: recipe.templates }))

// `Inherit` is the absence of a theme, so it is offered by the client rather than stored.
const themes = builtInThemes.filter(theme => theme.themeId !== 'inherit')

const known = new Set(presets.map(preset => preset.presetId))
for (const recipe of recipes) {
  const missing = recipe.presetIds.filter(id => !known.has(id))
  if (missing.length) throw new Error(`Recipe "${recipe.recipeId}" refers to unknown presets: ${missing.join(', ')}.`)
}

const bytes = JSON.stringify(presets).length
const deepest = Math.max(...presets.map(preset => depthOf(preset.document)))
console.info(`Parsed ${presets.length} presets (${Math.round(bytes / 1024)} KB, deepest ${deepest} of ${MAX_STORED_DEPTH - 2} levels), ${recipes.length} recipes and ${themes.length} themes.`)

if (out) {
  await writeFile(out, `${JSON.stringify({ presets, recipes, themes }, null, 2)}\n`)
  console.info(`Wrote ${out}.`)
} else if (dryRun) {
  console.info('Dry run: every preset parsed, flattened, validated, and round-tripped. Nothing was pushed.')
} else if (recipesOnly) {
  console.info(`Pushing recipes only to the ${prod ? 'production' : 'dev'} deployment.`)
  console.info(run('presets:seedRecipes', { recipes }))
} else {
  console.info(`Pushing to the ${prod ? 'production' : 'dev'} deployment.`)
  let inserted = 0
  let updated = 0
  for (let at = 0; at < presets.length; at += BATCH) {
    const batch = presets.slice(at, at + BATCH)
    const result = JSON.parse(run('presets:seedBuiltIns', { presets: batch })) as { inserted: number; updated: number }
    inserted += result.inserted
    updated += result.updated
    console.info(`  ${Math.min(at + BATCH, presets.length)}/${presets.length} presets`)
  }
  run('presets:seedRecipes', { recipes })
  run('presets:seedThemes', { themes })
  console.info(`Seeded ${inserted} new and ${updated} updated presets, ${recipes.length} recipes and ${themes.length} themes.`)
}
