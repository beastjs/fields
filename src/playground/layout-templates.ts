import type { CompilationProject } from './contracts'
import { helloWorld } from './examples'
import { usesTailwind } from './tailwind-import'

export type LayoutSection = 'topbar'

export interface LayoutTemplate {
  id: string
  section: LayoutSection
  title: string
  description: string
  /** The component file this template becomes inside a project. */
  file: string
  source: string
}

export const topbarTemplates: LayoutTemplate[] = [
  {
    id: 'topbar-marketing',
    section: 'topbar',
    file: '/src/Topbar.btsx',
    title: 'Marketing',
    description: 'Brand, primary links, and a sign-in / call-to-action pair. Links collapse on narrow screens.',
    source: `setup
  const links = ['Product', 'Pricing', 'Docs', 'Blog'];

header(className='border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80')
  nav(className='mx-auto flex h-14 max-w-5xl items-center gap-8 px-4')
    a(href='#' className='flex items-center gap-2 font-semibold')
      span(className='grid size-7 place-items-center rounded-lg bg-orange-500 text-sm text-white') B
      span Beast
    div(className='hidden items-center gap-5 text-sm text-zinc-600 sm:flex dark:text-zinc-400')
      each link in links key link
        a(href='#' className='hover:text-zinc-950 dark:hover:text-white') #{link}
    div(className='ml-auto flex items-center gap-2 text-sm')
      a(href='#' className='rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800') Sign in
      a(href='#' className='rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200') Get started
`
  },
  {
    id: 'topbar-app-search',
    section: 'topbar',
    file: '/src/Topbar.btsx',
    title: 'App with search',
    description:
      'A product shell: brand, a wide search field with a shortcut hint, notifications, and an account avatar.',
    source: `header(className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900')
  div(className='flex h-14 items-center gap-4 px-4')
    a(href='#' className='flex shrink-0 items-center gap-2 font-semibold')
      span(className='grid size-7 place-items-center rounded-md bg-indigo-600 text-sm text-white') A
      span(className='hidden sm:inline') Acme
    label(className='flex max-w-md flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-500 focus-within:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400')
      span(aria-hidden='true') ⌕
      input(type='search' placeholder='Search projects…' className='min-w-0 flex-1 bg-transparent text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100')
      kbd(className='hidden rounded border border-zinc-300 px-1.5 text-xs sm:inline dark:border-zinc-600') ⌘K
    div(className='ml-auto flex items-center gap-3')
      button(type='button' aria-label='Notifications' className='relative grid size-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800')
        span(aria-hidden='true') ◔
        span(className='absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500')
      button(type='button' aria-label='Account' className='grid size-8 place-items-center rounded-full bg-linear-to-br from-amber-400 to-rose-500 text-xs font-semibold text-white') JD
`
  },
  {
    id: 'topbar-centered',
    section: 'topbar',
    file: '/src/Topbar.btsx',
    title: 'Centered brand',
    description: 'A balanced editorial bar: navigation on the left, the brand centered, and actions on the right.',
    source: `setup
  const links = ['Shop', 'Journal', 'About'];

header(className='bg-stone-50 text-stone-800 dark:bg-stone-950 dark:text-stone-200')
  nav(className='mx-auto grid h-16 max-w-5xl grid-cols-3 items-center px-4 text-sm')
    div(className='flex items-center gap-5')
      each link in links key link
        a(href='#' className='hidden hover:underline sm:inline') #{link}
      button(type='button' aria-label='Open menu' className='sm:hidden') ☰
    a(href='#' className='justify-self-center font-serif text-xl tracking-[0.3em] uppercase') Maison
    div(className='flex items-center justify-end gap-4')
      a(href='#' className='hidden sm:inline') Account
      a(href='#' className='rounded-full border border-current px-3 py-1') Bag (2)
`
  },
  {
    id: 'topbar-responsive-menu',
    section: 'topbar',
    file: '/src/Topbar.btsx',
    title: 'Responsive menu',
    description: 'Inline links on wide screens and a toggleable dropdown menu on narrow ones, with local open state.',
    source: `import { useState } from 'octane'

setup
  const [open, setOpen] = useState(false);
  const links = ['Features', 'Customers', 'Changelog', 'Contact'];

header(className='relative border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900')
  nav(className='mx-auto flex h-14 max-w-5xl items-center justify-between px-4')
    a(href='#' className='font-semibold tracking-tight') ▲ Summit
    div(className='hidden items-center gap-6 text-sm md:flex')
      each link in links key link
        a(href='#' className='text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white') #{link}
    button(type='button' aria-expanded={open} aria-label='Toggle menu' className='rounded-md px-2 py-1 text-lg hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-800' onClick={() => setOpen(!open)}) #{open ? '✕' : '☰'}
  if open
    div(className='absolute inset-x-0 top-full grid gap-1 border-b border-zinc-200 bg-white p-3 text-sm shadow-lg md:hidden dark:border-zinc-800 dark:bg-zinc-900')
      each link in links key link
        a(href='#' className='rounded-md px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800' onClick={() => setOpen(false)}) #{link}
`
  },
  {
    id: 'topbar-dashboard',
    section: 'topbar',
    file: '/src/Topbar.btsx',
    title: 'Dashboard breadcrumbs',
    description: 'A compact workspace header with a breadcrumb trail, an environment badge, and a primary action.',
    source: `setup
  const trail = ['Workspace', 'Projects', 'Website'];

header(className='flex h-12 items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-950')
  span(className='grid size-6 place-items-center rounded bg-emerald-600 text-xs font-bold text-white') W
  ol(className='flex min-w-0 items-center gap-2 text-zinc-500')
    each crumb, index in trail key crumb
      li(className='flex items-center gap-2 truncate')
        if index > 0
          span(aria-hidden='true' className='text-zinc-300 dark:text-zinc-700') /
        span(className={index === trail.length - 1 ? 'font-medium text-zinc-900 dark:text-zinc-100' : ''}) #{crumb}
  span(className='ml-2 hidden rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 sm:inline dark:bg-emerald-950 dark:text-emerald-300') Production
  button(type='button' className='ml-auto rounded-md bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-500') Deploy
`
  }
]

export const layoutTemplates: Record<LayoutSection, LayoutTemplate[]> = { topbar: topbarTemplates }

const PREVIEW_APP = `import Topbar from './Topbar.btsx'

div(className='min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100')
  Topbar
  main(className='mx-auto grid max-w-5xl gap-4 p-6')
    div(className='h-28 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/60')
    div(className='grid gap-4 sm:grid-cols-3')
      div(className='h-20 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/60')
      div(className='h-20 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/60')
      div(className='h-20 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/60')
`

/** Tailwind's `dark:` variant follows the preview's data-theme instead of the OS setting. */
const DARK_VARIANT = '@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));'
const PREVIEW_STYLE = `@import "tailwindcss";
${DARK_VARIANT}
`
/** Utilities without Preflight, matching the starter project, so existing element styles keep working. */
const TAILWIND_UTILITIES = `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
`

/** A minimal, self-contained project that renders one template over placeholder page content. */
export function templatePreviewProject(template: LayoutTemplate): CompilationProject {
  return {
    entry: helloWorld.entry,
    files: {
      '/src/main.ts': helloWorld.files['/src/main.ts'].replace("console.info('Hello from the preview.');\n", ''),
      '/src/style.css': PREVIEW_STYLE,
      '/src/App.btsx': PREVIEW_APP,
      [template.file]: template.source
    }
  }
}

export interface TemplateInstall {
  /** New or changed files only; empty when the project already contains the template as-is. */
  files: Record<string, string>
  /** The template overwrites a different file at the same path. */
  replaces: boolean
  /** App.btsx renders the template; false when it could not be updated automatically. */
  rendered: boolean
}

const APP_FILE = '/src/App.btsx'
const STYLE_FILE = '/src/style.css'
const IMPORT_END = /\bfrom\s*['"]|^import\s*['"]/
const COMPONENT_BLOCK = /^(?:export\s+)?(?:default\s+)?component\b/
const HEADER_LINE = /^(?:import|export|module|props|setup)(?=[\s(]|$)/

/**
 * The project changes that add a template: its component file, an import and usage above the
 * existing markup in App.btsx, and Tailwind utilities with a `dark:` variant that follows the preview theme.
 */
export function installLayoutTemplate(project: CompilationProject, template: LayoutTemplate): TemplateInstall {
  const files: Record<string, string> = {}
  const write = (path: string, source: string) => { if (project.files[path] !== source) files[path] = source }
  const existing = project.files[template.file]
  write(template.file, template.source)

  const app = project.files[APP_FILE]
  const rendered = app === undefined ? undefined : renderComponent(app, componentName(template.file), importPath(APP_FILE, template.file))
  if (rendered !== undefined) write(APP_FILE, rendered)

  const stylesheet = Object.keys(project.files).find(path => path.endsWith('.css') && usesTailwind(project.files[path])) ?? STYLE_FILE
  const css = project.files[stylesheet]
  if (css !== undefined) write(stylesheet, withTemplateStyles(css))
  else {
    write(stylesheet, PREVIEW_STYLE)
    const entry = project.files[project.entry]
    if (!entry.includes(importPath(project.entry, stylesheet))) {
      write(project.entry, addImport(entry, `import '${importPath(project.entry, stylesheet)}';`))
    }
  }
  return { files, replaces: existing !== undefined && existing !== template.source, rendered: rendered !== undefined }
}

const componentName = (file: string) => file.slice(file.lastIndexOf('/') + 1).replace(/\.\w+$/, '')

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

function withTemplateStyles(css: string) {
  const styled = usesTailwind(css) ? css : TAILWIND_UTILITIES + css
  if (/@custom-variant\s+dark\b/.test(styled)) return styled
  const imports = [...styled.matchAll(/^@import\b[^;]*;[^\n]*\n?/gm)]
  const last = imports[imports.length - 1]
  const at = last ? last.index! + last[0].length : 0
  return `${styled.slice(0, at)}${at && styled[at - 1] !== '\n' ? '\n' : ''}${DARK_VARIANT}\n${styled.slice(at)}`
}
