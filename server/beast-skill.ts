import { beastSkillReferences } from '../src/generated/beast-skill-references'

// The vendored Beast agent skill (.agents/skills/beast). The chat model cannot read files, so the
// references it would route to are bundled at build time (scripts/prepare-runtime.mjs) and injected
// into the system prompt.

/** Always relevant to editing BTSX in the playground. */
const core = ['beast-syntax-core.md', 'beast-syntax-control.md', 'beast-syntax-advanced.md', 'octane-hooks-core.md', 'beast-diagnostics.md']

/** Included only when the conversation or attached source touches the topic. CLI, bundler, and editor references are omitted: the chat assistant cannot run commands. */
const routed: [RegExp, string][] = [
  [/\buse(?:Effect|LayoutEffect|InsertionEffect|SyncExternalStore|ImperativeHandle)\b|custom hook|subscri/i, 'octane-hooks-effects.md'],
  [/\buse(?:Transition|DeferredValue|ActionState|Optimistic|FormStatus)\b|\bPromise\b|\bawait\b|\bSuspense\b/i, 'octane-hooks-async.md'],
  [/\bforms?\b|tanstack-form|useForm\b/i, 'octane-tanstack-form.md'],
  [/\btables?\b|data[- ]?grid|tanstack-table/i, 'octane-tanstack-table.md'],
  [/design system|\breact\b|shadcn|radix|bindings/i, 'octane-bindings.md'],
  [/reusable|component library|(?:new|create|build|make) (?:a |an )?\w* ?component/i, 'ui-component-authoring.md']
]

const load = (name: string) => beastSkillReferences[name] ?? ''

/** Beast skill references relevant to this request, formatted for the system prompt. */
export function beastSkill(haystack: string) {
  const names = [...core, ...routed.filter(([pattern]) => pattern.test(haystack)).map(([, name]) => name)]
  const sections = names.map(load).filter(Boolean)
  if (!sections.length) return ''
  return `\n\nBeast skill reference (authoritative for BTSX syntax, Octane hooks, and diagnostics; prefer it over prior knowledge):\n\n${sections.join('\n\n---\n\n')}`
}
