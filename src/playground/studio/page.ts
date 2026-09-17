import type { CompilationProject } from '../contracts'
import { helloWorld } from '../examples'
import { usesTailwind } from '../tailwind-import'
import { kindOrder, sectionKind, sectionKinds, sectionTemplate, sectionTemplates, templatesOf } from './catalog'
import type { PageRecipe, SectionKindId } from './types'

export const PAGE_FILE = '/src/Page.btsx'
export const SECTIONS_DIRECTORY = '/src/sections/'
const APP_FILE = '/src/App.btsx'
const STYLE_FILE = '/src/style.css'
const STARTER_COUNTER = '/src/Counter.btsx'
const PAGE_MARKER = '// Composed in Design Studio.'
const STYLES_MARKER = '/* Design Studio sections'

/** One section on the page. */
export interface PageBlock {
  /** Component name and stable key: the kind's component, numbered when a kind repeats (Features, Features2). */
  name: string
  kind: SectionKindId
  /** The template the block renders; undefined when its file was edited and no longer matches one. */
  templateId?: string
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
`
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
  return `${PAGE_MARKER} Reorder sections there, or edit this file by hand.\n${imports}\ndiv(data-page='home')\n${sections}`
}

/** The page's sections, in order, as the studio wrote them to Page.btsx. */
export function readPage(project: CompilationProject): PageBlock[] {
  const source = project.files[PAGE_FILE]
  if (source === undefined) return []
  const imported = new Set<string>()
  for (const [, name, file] of source.matchAll(/^import\s+(\w+)\s+from\s+['"]\.\/sections\/(\w+)\.btsx['"]/gm)) {
    if (name === file) imported.add(name)
  }
  const blocks: PageBlock[] = []
  for (const [, name] of source.matchAll(/^\s+(\w+)\s*$/gm)) {
    const kind = sectionKinds.find(candidate => candidate.component === name.replace(/\d+$/, ''))
    const file = project.files[sectionFile(name)]
    if (!imported.has(name) || !kind || file === undefined || blocks.some(block => block.name === name)) continue
    blocks.push({ name, kind: kind.id, templateId: templatesOf(kind.id).find(template => template.source === file)?.id })
  }
  return blocks
}

export const samePage = (a: PageBlock[], b: PageBlock[]) =>
  a.length === b.length && a.every((block, index) => block.name === b[index].name && block.templateId === b[index].templateId)

/** Adds a template as a new block, by default after the last block that belongs earlier in the page's story. */
export function addSection(blocks: PageBlock[], templateId: string, at?: number): { blocks: PageBlock[]; name: string } {
  const template = sectionTemplate(templateId)
  if (!template) throw new Error(`Unknown section template "${templateId}".`)
  const base = sectionKind(template.kind).component
  let name = base
  for (let count = 2; blocks.some(block => block.name === name); count++) name = `${base}${count}`
  const order = kindOrder(template.kind)
  const index = at ?? blocks.reduce((end, block, position) => (kindOrder(block.kind) <= order ? position + 1 : end), 0)
  const next = [...blocks]
  next.splice(index, 0, { name, kind: template.kind, templateId })
  return { blocks: next, name }
}

export const swapTemplate = (blocks: PageBlock[], name: string, templateId: string) =>
  blocks.map(block => (block.name === name ? { ...block, templateId } : block))

export const recipeBlocks = (recipe: PageRecipe) =>
  recipe.templates.reduce<PageBlock[]>((blocks, templateId) => addSection(blocks, templateId, blocks.length).blocks, [])

/** A block's current source: its template, or the project's edited file. */
export const blockSource = (project: CompilationProject, block: PageBlock) =>
  (block.templateId === undefined ? undefined : sectionTemplate(block.templateId)?.source) ?? project.files[sectionFile(block.name)] ?? ''

/** A minimal, self-contained project that renders the page exactly as it would be installed. */
export function pagePreviewProject(project: CompilationProject, blocks: PageBlock[]): CompilationProject {
  const files: Record<string, string> = {
    '/src/main.ts': helloWorld.files['/src/main.ts'].replace("console.info('Hello from the preview.');\n", ''),
    [STYLE_FILE]: STUDIO_STYLESHEET,
    [APP_FILE]: PAGE_APP,
    [PAGE_FILE]: composePage(blocks)
  }
  for (const block of blocks) files[sectionFile(block.name)] = blockSource(project, block)
  return { entry: helloWorld.entry, files }
}

export interface PageInstall {
  /** New or changed files only; empty when the project already contains the page as-is. */
  files: Record<string, string>
  /** Section files the page no longer uses. Each still matches a template, so no edits are lost. */
  removes: string[]
  /** Files with edits of their own that the install replaces. */
  overwrites: string[]
  /** App.btsx was the untouched starter and now renders only the page. */
  replacesStarter: boolean
  /** App.btsx renders the page; false when it could not be updated automatically. */
  rendered: boolean
}

const isTemplateSource = (source: string | undefined) => sectionTemplates.some(template => template.source === source)

/**
 * The project changes that install a page: one component per section under /src/sections/, Page.btsx composing
 * them, App.btsx rendering Page, and Tailwind with the studio's element defaults in the project stylesheet.
 */
export function planPageInstall(project: CompilationProject, blocks: PageBlock[]): PageInstall {
  const files: Record<string, string> = {}
  const write = (path: string, source: string) => { if (project.files[path] !== source) files[path] = source }
  const overwrites: string[] = []

  for (const block of blocks) {
    if (block.templateId === undefined) continue
    const path = sectionFile(block.name)
    const existing = project.files[path]
    const source = blockSource(project, block)
    if (existing !== undefined && existing !== source && !isTemplateSource(existing)) overwrites.push(path)
    write(path, source)
  }
  const current = readPage(project)
  const page = project.files[PAGE_FILE]
  if (page !== undefined && page !== composePage(blocks) && page !== composePage(current)) overwrites.push(PAGE_FILE)
  write(PAGE_FILE, composePage(blocks))

  const used = new Set(blocks.map(block => block.name))
  const removes = current.filter(block => block.templateId !== undefined && !used.has(block.name)).map(block => sectionFile(block.name))

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
  if (css !== undefined && !(replacesStarter && css === helloWorld.files[STYLE_FILE])) write(stylesheet, withStudioStyles(css))
  else {
    write(stylesheet, STUDIO_STYLESHEET)
    const entry = project.files[project.entry]
    if (entry !== undefined && !entry.includes(importPath(project.entry, stylesheet))) {
      write(project.entry, addImport(entry, `import '${importPath(project.entry, stylesheet)}';`))
    }
  }
  return { files, removes, overwrites, replacesStarter, rendered }
}

function withStudioStyles(css: string) {
  const styled = usesTailwind(css) ? css : TAILWIND_UTILITIES + css
  if (styled.includes(STYLES_MARKER)) return styled
  return `${styled}${styled.endsWith('\n') ? '' : '\n'}\n${STUDIO_STYLES}`
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
