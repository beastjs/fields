import { describe, expect, test } from 'bun:test'
import { checkSlug, RESERVED_SLUGS, SLUG_MAX_LENGTH, siteUrl, suggestSlug } from '../convex/siteSlugs'

// The hosting Worker's own rule; every product slug must also pass it.
const WORKER_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

describe('site slugs', () => {
  test('accepts readable DNS labels, trimming and lowercasing input', () => {
    expect(checkSlug('  My-Site-2 ')).toEqual({ ok: true, slug: 'my-site-2' })
    expect(checkSlug('abc').ok).toBe(true)
    expect(checkSlug('a'.repeat(SLUG_MAX_LENGTH)).ok).toBe(true)
  })

  test('rejects malformed, lookalike and reserved names with a reason', () => {
    for (const input of ['ab', 'a'.repeat(SLUG_MAX_LENGTH + 1), '-abc', 'abc-', 'a_b', 'a.b', 'héllo', 'xn--80ak6aa92e', 'www', 'Admin']) {
      const check = checkSlug(input)
      expect(check.ok).toBe(false)
      if (!check.ok) expect(check.reason.length).toBeGreaterThan(0)
    }
  })

  test('suggestions are always valid and pass the Worker', () => {
    const cases: [string, string][] = [
      ['My Cool Site!', 'my-cool-site'],
      ['Café Déjà Vu', 'cafe-deja-vu'],
      ['  --Hello__World--  ', 'hello-world'],
      ['UI', 'ui-site'],
      ['www', 'www-site'],
      ['🔥🔥', 'my-site'],
      ['', 'my-site'],
      ['xn--thing', 'xn-thing'] // collapsing hyphens already rules out punycode
    ]
    for (const [name, expected] of cases) expect(suggestSlug(name)).toBe(expected)
    for (const name of [...cases.map(([name]) => name), 'x'.repeat(200), `${'a'.repeat(47)} b`, ...RESERVED_SLUGS]) {
      const slug = suggestSlug(name)
      expect(checkSlug(slug)).toEqual({ ok: true, slug })
      expect(WORKER_SLUG.test(slug)).toBe(true)
    }
  })

  test('builds site URLs from the configured template', () => {
    expect(siteUrl('https://{slug}.playsites.dev', 'hello')).toBe('https://hello.playsites.dev')
    expect(siteUrl('http://{slug}.localhost:8787', 'hello')).toBe('http://hello.localhost:8787')
    expect(siteUrl(undefined, 'hello')).toBeNull()
    expect(siteUrl('https://playsites.dev', 'hello')).toBeNull()
  })
})
