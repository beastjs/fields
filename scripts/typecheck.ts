/**
 * Type-checks the app, including its `.btsx` components.
 *
 * `tsrx-tsc` only recognises `.tsrx` files, so `.btsx` components would otherwise be checked as nothing more than the
 * `*.btsx` ambient module in src/env.d.ts. This compiles each component to TSRX exactly as the rsbuild loader does,
 * writes it to a shadow tree under .beast/typecheck, and runs `tsrx-tsc` over a tsconfig that overlays that tree on
 * the project (`rootDirs` for relative imports, `paths` for aliases). Any module whose imports name a `.btsx` file is
 * shadowed with those specifiers renamed to `.tsrx` so they resolve to the compiled component instead of the ambient
 * declaration; the rename keeps every offset, so diagnostics map straight back through Beast's source map.
 *
 *   bun scripts/typecheck.ts
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEAST_UPPER_BOUND, originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { BeastCompileError, compileBeastResult, componentNameFromPath, formatDiagnostic } from 'beast-tsrx'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHADOW = '.beast/typecheck'
const SOURCE = 'src'

/** A shadowed module: `map` is present when the shadow is compiled output rather than a renamed copy. */
interface Shadow {
  source: string
  map?: TraceMap
}

const toPosix = (path: string) => path.split('\\').join('/')

/** Renames `.btsx` import specifiers to `.tsrx`, in place and at equal length so positions stay valid. */
function renameComponentImports(code: string): { code: string; renamed: boolean } {
  let next = code
  let renamed = false
  for (const { fileName, pos } of ts.preProcessFile(code, true, true).importedFiles) {
    // `pos` is the opening quote, so the specifier text ends one character past `pos + fileName.length`.
    const end = pos + 1 + fileName.length
    if (!fileName.endsWith('.btsx') || code.slice(end - 5, end) !== '.btsx') continue
    next = `${next.slice(0, end - 5)}.tsrx${next.slice(end)}`
    renamed = true
  }
  return { code: next, renamed }
}

function write(path: string, code: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, code)
}

function buildShadowTree(): { shadows: Map<string, Shadow>; failures: number } {
  rmSync(join(ROOT, SHADOW), { recursive: true, force: true })
  const shadows = new Map<string, Shadow>()
  let failures = 0
  const files = readdirSync(join(ROOT, SOURCE), { recursive: true, encoding: 'utf8' }).map(toPosix).sort()
  for (const file of files) {
    const source = `${SOURCE}/${file}`
    const code = /\.(btsx|tsx?)$/.test(file) && !file.endsWith('.d.ts') ? readFileSync(join(ROOT, source), 'utf8') : null
    if (code === null) continue
    if (file.endsWith('.btsx')) {
      const target = source.replace(/\.btsx$/, '.tsrx')
      if (existsSync(join(ROOT, target))) throw new Error(`${target} would be shadowed by the compiled ${source}.`)
      try {
        const result = compileBeastResult(code, { filename: source, componentName: componentNameFromPath(source) })
        write(join(ROOT, SHADOW, target), renameComponentImports(result.code).code)
        shadows.set(`${SHADOW}/${target}`, { source, map: new TraceMap(JSON.stringify(result.map)) })
      } catch (error) {
        if (!(error instanceof BeastCompileError)) throw error
        console.error(formatDiagnostic(error.diagnostic, code))
        failures++
      }
      continue
    }
    const renamed = renameComponentImports(code)
    if (!renamed.renamed) continue
    write(join(ROOT, SHADOW, source), renamed.code)
    shadows.set(`${SHADOW}/${source}`, { source })
  }
  return { shadows, failures }
}

/** Overlays the shadow tree on tsconfig.json; shadowed originals leave the program so nothing is reported twice. */
function writeTsconfig(shadows: Map<string, Shadow>): string {
  const base = ts.readConfigFile(join(ROOT, 'tsconfig.json'), ts.sys.readFile)
  if (base.error) throw new Error(ts.flattenDiagnosticMessageText(base.error.messageText, '\n'))
  const config: { compilerOptions?: { paths?: Record<string, string[]> }; include?: string[] } = base.config
  const toShadow = (path: string) => `./${SHADOW}/${path.replace(/^\.\//, '')}`
  const paths = Object.fromEntries(Object.entries(config.compilerOptions?.paths ?? {})
    .map(([alias, targets]) => [alias, targets.flatMap(target => [toShadow(target), target])]))
  const up = relative(join(ROOT, SHADOW), ROOT)
  const path = join(ROOT, SHADOW, 'tsconfig.json')
  write(path, `${JSON.stringify({
    extends: `${up}/tsconfig.json`,
    compilerOptions: { baseUrl: up, rootDirs: [up, '.'], paths },
    include: [...(config.include ?? []).map(entry => `${up}/${entry}`), `./${SOURCE}`],
    exclude: [...shadows.values()].filter(shadow => !shadow.map).map(shadow => `${up}/${shadow.source}`),
  }, null, 2)}\n`)
  return path
}

/** Rewrites a shadow location to its source file, mapping compiled components through Beast's source map. */
function locate(shadows: Map<string, Shadow>, file: string, line: number, column: number): string | null {
  const shadow = shadows.get(toPosix(relative(ROOT, resolve(ROOT, file))))
  if (!shadow) return null
  if (!shadow.map) return `${shadow.source}(${line},${column})`
  // Generated scaffolding has no mapping of its own; fall forward to the next mapped segment on the line.
  const needle = { line, column: column - 1 }
  const nearest = originalPositionFor(shadow.map, needle)
  const original = nearest.line === null ? originalPositionFor(shadow.map, { ...needle, bias: LEAST_UPPER_BOUND }) : nearest
  return original.line === null
    ? `${shadow.source}(1,1): [generated ${shadow.source.replace(/\.btsx$/, '.tsrx')}(${line},${column})]`
    : `${shadow.source}(${original.line},${original.column + 1})`
}

function remap(shadows: Map<string, Shadow>, output: string): string {
  return output.split('\n').map(line => {
    const diagnostic = /^(.+?)\((\d+),(\d+)\)(: .*)$/.exec(line)
    if (diagnostic) {
      const [, file, row, column, rest] = diagnostic
      const located = locate(shadows, file, Number(row), Number(column))
      return located ? `${located}${rest}` : line
    }
    const note = /^\[tsrx-tsc\] (.+?): (.*)$/.exec(line)
    const shadow = note ? shadows.get(toPosix(relative(ROOT, note[1]))) : undefined
    return note && shadow ? `[tsrx-tsc] ${shadow.source}: ${note[2]}` : line
  }).join('\n')
}

const { shadows, failures } = buildShadowTree()
const components = [...shadows.values()].filter(shadow => shadow.map).length
const tsconfig = writeTsconfig(shadows)
const tsc = spawnSync(join(ROOT, 'node_modules/.bin/tsrx-tsc'), ['-p', tsconfig, '--noEmit', '--pretty', 'false'],
  { cwd: ROOT, encoding: 'utf8' })
if (tsc.error) throw tsc.error
const stdout = remap(shadows, tsc.stdout).trimEnd()
const stderr = remap(shadows, tsc.stderr).trimEnd()
if (stdout) console.log(stdout)
if (stderr) console.error(stderr)
console.log(`Type-checked ${SOURCE} with ${components} compiled .btsx component(s) from ${SHADOW}.`)
process.exit(tsc.status === 0 && failures === 0 ? 0 : 1)
