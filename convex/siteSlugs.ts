/**
 * A site's slug is its subdomain on the hosting domain. The hosting Worker accepts any DNS label; the product is
 * stricter, so addresses stay readable and a few names stay ours.
 */
export const SLUG_MIN_LENGTH = 3
export const SLUG_MAX_LENGTH = 48

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/** Infrastructure, product and abuse-prone names nobody can claim. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'abuse', 'account', 'admin', 'administrator', 'api', 'app', 'apps', 'assets', 'auth', 'autoconfig', 'autodiscover',
  'billing', 'blog', 'cdn', 'dashboard', 'dev', 'docs', 'email', 'ftp', 'help', 'hostmaster', 'imap', 'internal',
  'login', 'mail', 'mx', 'ns1', 'ns2', 'ns3', 'ns4', 'official', 'play', 'playground', 'pop', 'pop3', 'postmaster',
  'preview', 'root', 'security', 'signin', 'signup', 'smtp', 'staging', 'static', 'status', 'support', 'system',
  'test', 'webmail', 'webmaster', 'www'
])

export type SlugCheck = { ok: true; slug: string } | { ok: false; slug: string; reason: string }

/** Validates what someone typed, after trimming and lowercasing; it never rewrites the name itself. */
export function checkSlug(input: string): SlugCheck {
  const slug = input.trim().toLowerCase()
  const fail = (reason: string): SlugCheck => ({ ok: false, slug, reason })
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return fail(`Use ${SLUG_MIN_LENGTH}–${SLUG_MAX_LENGTH} characters.`)
  }
  if (!SLUG_PATTERN.test(slug)) {
    return fail('Use lowercase letters, numbers and hyphens, starting and ending with a letter or number.')
  }
  // Punycode labels would let a slug render as a different, lookalike Unicode name.
  if (slug.startsWith('xn--')) return fail('Addresses cannot start with “xn--”.')
  if (RESERVED_SLUGS.has(slug)) return fail('That address is reserved.')
  return { ok: true, slug }
}

/** A valid starting slug from a project name: `My Cool Site!` → `my-cool-site`. */
export function suggestSlug(name: string): string {
  let slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '')
  if (!slug) return 'my-site'
  if (slug.length < SLUG_MIN_LENGTH || RESERVED_SLUGS.has(slug)) slug = `${slug}-site`
  return slug
}

/**
 * `HOSTING_SITE_URL` is a template such as `https://{slug}.playsites.dev`, or `http://{slug}.localhost:8787` against
 * a local hosting Worker. Unset, sites have no public address yet.
 */
export function siteUrl(template: string | undefined, slug: string): string | null {
  return template?.includes('{slug}') ? template.replace('{slug}', slug) : null
}
