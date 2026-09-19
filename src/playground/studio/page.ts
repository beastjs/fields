import type { CompilationProject } from '../contracts'
import { helloWorld } from '../examples'
import { usesTailwind } from '../tailwind-import'
import { renderPreset } from './ir/render'
import { parsePreset } from './ir/parse'
import { applyOverrides } from './ir/overrides'
import type { NodeOverride, PresetDocument } from './ir/types'
import { THEME_BASE, THEME_BLOCK, themeCss, themeIdFromCss, type ThemeDocument } from './themes'
import { kindOrder, sectionKind, sectionKinds } from './kinds'
import type { PresetLookup } from './presets'
import type { SectionKindId } from './types'

export const PAGE_FILE = '/src/Page.btsx'
export const SECTIONS_DIRECTORY = '/src/sections/'
const APP_FILE = '/src/App.btsx'
const STYLE_FILE = '/src/style.css'
const STARTER_COUNTER = '/src/Counter.btsx'
const PAGE_MARKER = '// Composed in Design Studio.'
/** Records which preset each section came from, so reading a page back never has to match it by source text. */
const PRESET_MARKER = '// presets: '
const STYLES_MARKER = '/* Design Studio sections'

/** One section on the page. */
export interface PageBlock {
  /** Component name and stable key: the kind's component, numbered when a kind repeats (Features, Features2). */
  name: string
  kind: SectionKindId
  /** The preset the block renders; undefined for a section written by hand that the studio did not compose. */
  presetId?: string
  /**
   * The project's file for this section no longer matches its preset, so the file wins: the preview shows it and
   * the install leaves it alone. Set by `readPage`, and cleared when a new design is chosen.
   */
  edited?: boolean
  /** Fine Layout edits, keyed by node id. Non-destructive: the preset itself is never changed. */
  overrides?: Record<string, NodeOverride>
}

export const sectionFile = (name: string) => `${SECTIONS_DIRECTORY}${name}.btsx`

/** Element defaults sections rely on when a project has no Preflight reset, plus the marquee keyframes. */
const STUDIO_STYLES = `${STYLES_MARKER}: element defaults and motion. */
@layer base {
  [data-section], [data-section] * { box-sizing: border-box; }
  [data-section] :where(h1, h2, h3, h4, p, ul, ol, dl, dd, figure, blockquote) { margin: 0; }
  [data-section] :where(h1, h2, h3, h4) { font-size: inherit; font-weight: inherit; }
  [data-section] :where(ul, ol) { padding: 0; list-style: none; }
  [data-section] :where(a) { color: inherit; text-decoration: inherit; }
  [data-section] :where(button, input, select, textarea) { font: inherit; color: inherit; background: transparent; border: 0 solid; }
}
@keyframes studio-marquee { to { transform: translateX(-50%); } }
${THEME_BASE}`
/** Tailwind's `dark:` variant follows the preview's data-theme instead of the OS setting. */
const DARK_VARIANT = '@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));'
export const STUDIO_STYLESHEET = `@import "tailwindcss";
${DARK_VARIANT}

${STUDIO_STYLES}`
/** Utilities without Preflight, matching the starter project, so existing element styles keep working. */
const TAILWIND_UTILITIES = `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
`
const PAGE_APP = `import Page from './Page.btsx'

Page
`

export function composePage(blocks: PageBlock[]): string {
  // Sorted imports keep reordering a body-only change, which the preview applies without a reload.
  const imports = blocks.map(block => block.name).sort().map(name => `import ${name} from './sections/${name}.btsx'\n`).join('')
  const sections = blocks.map(block => `  ${block.name}\n`).join('')
  const linked = blocks.filter(block => block.presetId !== undefined)
  const presets = linked.length ? `${PRESET_MARKER}${linked.map(block => `${block.name}=${block.presetId}`).join(', ')}\n` : ''
  return `${PAGE_MARKER} Reorder sections there, or edit this file by hand.\n${presets}${imports}\ndiv(data-page='home')\n${sections}`
}

/** The preset each section came from, as `composePage` recorded it. */
function readPresetMarker(source: string): Map<string, string> {
  const line = source.split('\n').find(candidate => candidate.startsWith(PRESET_MARKER))
  if (!line) return new Map()
  const pairs = line.slice(PRESET_MARKER.length).split(',')
  return new Map(pairs.map(pair => pair.trim().split('=')).filter(parts => parts.length === 2) as [string, string][])
}

/**
 * The presets a project's page was composed from, readable before any of them have loaded.
 *
 * This is what tells the studio which documents to fetch, so it never needs a lookup to decide what to load.
 */
export function pagePresetIds(project: CompilationProject): string[] {
  const source = project.files[PAGE_FILE]
  if (source === undefined) return []
  return [...new Set(readPresetMarker(source).values())]
}

/** The theme currently applied to the project's Tailwind stylesheet. No generated block means Inherit. */
export function readProjectThemeId(project: CompilationProject): string | undefined {
  for (const [path, source] of Object.entries(project.files)) {
    if (!path.endsWith('.css') || !usesTailwind(source)) continue
    const themeId = themeIdFromCss(source)
    if (themeId !== undefined) return themeId
  }
  return undefined
}

/**
 * The page's sections, in order, as the studio wrote them to Page.btsx.
 *
 * A page composed before presets were recorded has no marker, so its sections read back unlinked and the studio
 * treats them as hand-written until a design is chosen for them again.
 */
export function readPage(project: CompilationProject, presets: PresetLookup): PageBlock[] {
  const source = project.files[PAGE_FILE]
  if (source === undefined) return []
  const composedFrom = readPresetMarker(source)
  const imported = new Set<string>()
  for (const [, name, file] of source.matchAll(/^import\s+(\w+)\s+from\s+['"]\.\/sections\/(\w+)\.btsx['"]/gm)) {
    if (name === file) imported.add(name)
  }
  const blocks: PageBlock[] = []
  for (const [, name] of source.matchAll(/^\s+(\w+)\s*$/gm)) {
    const kind = sectionKinds.find(candidate => candidate.component === name.replace(/\d+$/, ''))
    const file = project.files[sectionFile(name)]
    if (!imported.has(name) || !kind || file === undefined || blocks.some(block => block.name === name)) continue
    const presetId = composedFrom.get(name)
    // A preset that has not loaded yet reads as edited, so the preview shows the project's own file rather than
    // nothing; it corrects itself once the document arrives.
    const edited = presetId === undefined || file !== presets.source(presetId)
    blocks.push({ name, kind: kind.id, ...(presetId === undefined ? {} : { presetId }), ...(edited ? { edited: true } : {}) })
  }
  return blocks
}

export const samePage = (a: PageBlock[], b: PageBlock[]) =>
  a.length === b.length && a.every((block, index) => block.name === b[index].name && block.presetId === b[index].presetId)

/** Adds a preset as a new block, by default after the last block that belongs earlier in the page's story. */
export function addSection(blocks: PageBlock[], presetId: string, presets: PresetLookup, at?: number): { blocks: PageBlock[]; name: string } {
  const summary = presets.summary(presetId)
  if (!summary) throw new Error(`Unknown section preset "${presetId}".`)
  const base = sectionKind(summary.kind).component
  let name = base
  for (let count = 2; blocks.some(block => block.name === name); count++) name = `${base}${count}`
  const order = kindOrder(summary.kind)
  const index = at ?? blocks.reduce((end, block, position) => (kindOrder(block.kind) <= order ? position + 1 : end), 0)
  const next = [...blocks]
  next.splice(index, 0, { name, kind: summary.kind, presetId })
  return { blocks: next, name }
}

/** Chooses a new design for a block, which replaces whatever its file holds. */
export const swapPreset = (blocks: PageBlock[], name: string, presetId: string) =>
  blocks.map(block => (block.name === name ? { name: block.name, kind: block.kind, presetId } : block))

export const recipeBlocks = (presetIds: string[], presets: PresetLookup) =>
  presetIds.reduce<PageBlock[]>((blocks, presetId) => (presets.summary(presetId) ? addSection(blocks, presetId, presets, blocks.length).blocks : blocks), [])

/**
 * The tree a block renders, for Fine Layout to inspect and patch.
 *
 * A block that still matches its preset edits the preset's document. One whose file has been edited — by hand, or
 * by a previous install of its own Fine Layout edits — is parsed back from that file, so visual editing survives
 * the round trip through the project. Parsing is lossless and assigns ids in document order, so the ids line up
 * with the preset's as long as the structure is unchanged.
 */
export function blockDocument(project: CompilationProject, block: PageBlock, presets: PresetLookup): PresetDocument | undefined {
  if (block.edited) {
    const file = project.files[sectionFile(block.name)]
    if (file === undefined) return undefined
    try {
      const parsed = parsePreset(file, { id: block.name, kind: block.kind, title: block.name, description: '', wireframe: [] })
      return applyOverrides(parsed, block.overrides)
    } catch {
      // A hand-written section the parser does not accept simply cannot be edited visually.
      return undefined
    }
  }
  const document = block.presetId === undefined ? undefined : presets.document(block.presetId)
  return document && applyOverrides(document, block.overrides)
}

/**
 * A block's current source: the project's file once it has been edited, otherwise the preset it renders.
 *
 * `inspectable` stamps every element with `data-node` so Fine Layout can trace a hovered element back to the node
 * that produced it. Only the preview ever asks for it; an install never carries inspection attributes.
 */
export function blockSource(project: CompilationProject, block: PageBlock, presets: PresetLookup, inspectable = false) {
  const file = project.files[sectionFile(block.name)]
  if (inspectable) {
    const document = blockDocument(project, block, presets)
    // Prefixed with the block's name, which is unique on a page, so an edit lands only on the section it was made in.
    return document ? renderPreset(document, { inspectable: true, nodePrefix: block.name }) : file ?? ''
  }
  if (block.edited) {
    if (!block.overrides || !Object.keys(block.overrides).length) return file ?? ''
    const document = blockDocument(project, block, presets)
    return document ? renderPreset(document) : file ?? ''
  }
  return (block.presetId === undefined ? undefined : presets.source(block.presetId, block.overrides)) ?? file ?? ''
}

/** A minimal, self-contained project that renders the page exactly as it would be installed. */
export function pagePreviewProject(project: CompilationProject, blocks: PageBlock[], presets: PresetLookup, inspectable = false): CompilationProject {
  const files: Record<string, string> = {
    '/src/main.ts': helloWorld.files['/src/main.ts'].replace("console.info('Hello from the preview.');\n", ''),
    [STYLE_FILE]: STUDIO_STYLESHEET,
    [APP_FILE]: PAGE_APP,
    [PAGE_FILE]: composePage(blocks)
  }
  for (const block of blocks) files[sectionFile(block.name)] = blockSource(project, block, presets, inspectable)
  return { entry: helloWorld.entry, files }
}

export interface PageInstall {
  /** New or changed files only; empty when the project already contains the page as-is. */
  files: Record<string, string>
  /** Section files the page no longer uses. Each still matches its preset, so no edits are lost. */
  removes: string[]
  /** Files with edits of their own that the install replaces. */
  overwrites: string[]
  /** App.btsx was the untouched starter and now renders only the page. */
  replacesStarter: boolean
  /** App.btsx renders the page; false when it could not be updated automatically. */
  rendered: boolean
}

/**
 * The project changes that install a page: one component per section under /src/sections/, Page.btsx composing
 * them, App.btsx rendering Page, and Tailwind with the studio's element defaults in the project stylesheet.
 */
export function planPageInstall(project: CompilationProject, blocks: PageBlock[], presets: PresetLookup, theme?: ThemeDocument): PageInstall {
  const files: Record<string, string> = {}
  const write = (path: string, source: string) => { if (project.files[path] !== source) files[path] = source }
  const overwrites: string[] = []
  const current = readPage(project, presets)
  // How each section stood in the project, so replacing a pristine preset is silent and replacing an edit warns.
  const previous = new Map(current.map(block => [block.name, block]))

  for (const block of blocks) {
    if (block.presetId === undefined) continue
    const path = sectionFile(block.name)
    const existing = project.files[path]
    const source = blockSource(project, block, presets)
    if (existing !== undefined && existing !== source && previous.get(block.name)?.edited !== false) overwrites.push(path)
    write(path, source)
  }
  const page = project.files[PAGE_FILE]
  if (page !== undefined && page !== composePage(blocks) && page !== composePage(current)) overwrites.push(PAGE_FILE)
  write(PAGE_FILE, composePage(blocks))

  const used = new Set(blocks.map(block => block.name))
  // Only sections that still match their preset are removed; a hand-edited file is left in place rather than lost.
  const removes = current.filter(block => block.presetId !== undefined && !block.edited && !used.has(block.name)).map(block => sectionFile(block.name))

  const app = project.files[APP_FILE]
  const replacesStarter = app === helloWorld.files[APP_FILE]
  let rendered = app !== undefined
  if (replacesStarter) {
    write(APP_FILE, PAGE_APP)
    if (project.files[STARTER_COUNTER] === helloWorld.files[STARTER_COUNTER]) removes.push(STARTER_COUNTER)
  } else if (app !== undefined) {
    const next = renderComponent(app, 'Page', importPath(APP_FILE, PAGE_FILE))
    if (next === undefined) rendered = false
    else write(APP_FILE, next)
  }

  const stylesheet = Object.keys(project.files).find(path => path.endsWith('.css') && usesTailwind(project.files[path])) ?? STYLE_FILE
  const css = project.files[stylesheet]
  if (css !== undefined && !(replacesStarter && css === helloWorld.files[STYLE_FILE])) write(stylesheet, withStudioStyles(css, theme))
  else {
    write(stylesheet, withStudioStyles(STUDIO_STYLESHEET, theme))
    const entry = project.files[project.entry]
    if (entry !== undefined && !entry.includes(importPath(project.entry, stylesheet))) {
      write(project.entry, addImport(entry, `import '${importPath(project.entry, stylesheet)}';`))
    }
  }
  return { files, removes, overwrites, replacesStarter, rendered }
}

/** The project stylesheet with the studio's element defaults and, last, the chosen theme's custom properties. */
function withStudioStyles(css: string, theme?: ThemeDocument) {
  const styled = usesTailwind(css) ? css : TAILWIND_UTILITIES + css
  const withDefaults = styled.includes(STYLES_MARKER) ? styled : `${styled}${styled.endsWith('\n') ? '' : '\n'}\n${STUDIO_STYLES}`
  // Older installs already have the section marker but predate the rules that paint a page from theme tokens.
  // Upgrade those independently, preserving the project's own styles and avoiding duplicate section defaults.
  const withTheme = withDefaults.includes(THEME_BASE.trim()) ? withDefaults : `${withDefaults}\n${THEME_BASE}`
  // A previous theme is replaced rather than stacked, and the trailing newlines are normalised so that
  // re-installing the same theme produces a byte-identical stylesheet.
  const bare = `${withTheme.replace(THEME_BLOCK, '').replace(/\n+$/, '')}\n`
  const palette = theme ? themeCss(theme) : ''
  return palette ? `${bare}\n${palette}` : bare
}

const IMPORT_END = /\bfrom\s*['"]|^import\s*['"]/
const COMPONENT_BLOCK = /^(?:export\s+)?(?:default\s+)?component\b/
const HEADER_LINE = /^(?:import|export|module|props|setup)(?=[\s(]|$)/

/** A relative import from the importer's directory, or a root-absolute one the virtual filesystem also resolves. */
function importPath(importer: string, file: string) {
  const directory = importer.slice(0, importer.lastIndexOf('/') + 1)
  return file.startsWith(directory) ? `./${file.slice(directory.length)}` : file
}

/** The line just past the last import statement, and the first top-level template line (-1 when there is none). */
function sourceLayout(lines: string[]) {
  let imports = 0
  let root = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^import\b/.test(lines[i])) {
      while (!IMPORT_END.test(lines[i]) && i < lines.length - 1) i++
      imports = i + 1
    } else if (root < 0 && /^[^\s~/]/.test(lines[i]) && !HEADER_LINE.test(lines[i])) root = i
  }
  return { imports, root }
}

function addImport(source: string, statement: string) {
  const lines = source.split('\n')
  lines.splice(sourceLayout(lines).imports, 0, statement)
  return lines.join('\n')
}

/** Renders `name` above the file's first top-level element; undefined for layouts that need a person to decide. */
function renderComponent(source: string, name: string, path: string) {
  if (new RegExp(`^import\\s+${name}\\b`, 'm').test(source)) return source
  const lines = source.split('\n')
  if (lines.some(line => COMPONENT_BLOCK.test(line))) return undefined
  const { imports, root } = sourceLayout(lines)
  if (root < 0 || root < imports) return undefined
  lines.splice(root, 0, name)
  lines.splice(imports, 0, `import ${name} from '${path}'`, ...(imports === 0 ? [''] : []))
  return lines.join('\n')
}

/** Splits a stamped `data-node` back into the block it belongs to and the node within that block's document. */
export function readNodeId(stamped: string): { name: string; nodeId: string } | undefined {
  const at = stamped.indexOf(':')
  if (at <= 0 || at === stamped.length - 1) return undefined
  return { name: stamped.slice(0, at), nodeId: stamped.slice(at + 1) }
}
