export const fileLabel = (path: string) => path.replace(/^\/src\//, '')
export const fileIcon = (path: string) => (path.endsWith('.btsx') ? '⨂' : path.endsWith('.css') ? '#' : 'TS')
export const fileLanguage = (path: string) =>
  path.endsWith('.btsx')
    ? 'Beast'
    : path.endsWith('.css')
      ? 'CSS'
      : path.endsWith('.json')
        ? 'JSON'
        : path.endsWith('.js')
          ? 'JavaScript'
          : 'TypeScript'

/** Native roving-tab interaction shared by the file and developer-tool tab strips. */
export function navigateTabs(event: KeyboardEvent) {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
  const strip = event.currentTarget as HTMLElement
  const tabs = Array.from(strip.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
  if (current < 0) return
  event.preventDefault()
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  tabs[next].click()
  tabs[next].focus()
}
