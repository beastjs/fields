import type { PageRecipe, SectionKindId, SectionTemplate } from './types'
import { sectionKind } from './kinds'
import { topbarTemplates } from './sections/topbar'
import { heroTemplates } from './sections/hero'
import { partnersTemplates } from './sections/partners'
import { statsTemplates } from './sections/stats'
import { featuresTemplates } from './sections/features'
import { guidesTemplates } from './sections/guides'
import { productsTemplates } from './sections/products'
import { testimonialsTemplates } from './sections/testimonials'
import { pricingTemplates } from './sections/pricing'
import { faqTemplates } from './sections/faq'
import { teamTemplates } from './sections/team'
import { ctaTemplates } from './sections/cta'
import { newsletterTemplates } from './sections/newsletter'
import { footerTemplates } from './sections/footer'

/**
 * The built-in section templates, and the recipes that compose them.
 *
 * These are the authoring source for the seeded catalog, not what the app reads: `scripts/seed-presets.ts` parses
 * them into preset documents and pushes them to Convex, and the studio reads from there. Nothing in the app imports
 * this module, so the template sources stay out of the bundle.
 */
export type * from './types'
export { kindOrder, sectionKind, sectionKinds, sectionStages } from './kinds'

export const sectionTemplates: SectionTemplate[] = [
  ...topbarTemplates,
  ...heroTemplates,
  ...partnersTemplates,
  ...statsTemplates,
  ...featuresTemplates,
  ...guidesTemplates,
  ...productsTemplates,
  ...testimonialsTemplates,
  ...pricingTemplates,
  ...faqTemplates,
  ...teamTemplates,
  ...ctaTemplates,
  ...newsletterTemplates,
  ...footerTemplates
]

export const pageRecipes: PageRecipe[] = [
  {
    id: 'saas-launch',
    title: 'SaaS launch',
    description: 'The classic software landing page, from hero to pricing.',
    templates: ['topbar-marketing', 'hero-centered', 'partners-marquee', 'features-bento', 'guides-steps', 'testimonials-wall', 'pricing-tiers', 'faq-accordion', 'cta-banner', 'footer-columns']
  },
  {
    id: 'waitlist',
    title: 'Pre-launch waitlist',
    description: 'Collect early sign-ups and tell your founding story.',
    templates: ['topbar-responsive-menu', 'hero-waitlist', 'features-grid', 'team-founders', 'faq-accordion', 'footer-simple']
  },
  {
    id: 'storefront',
    title: 'Storefront',
    description: 'Sell products with reviews and a newsletter.',
    templates: ['topbar-centered', 'hero-statement', 'products-grid', 'testimonials-spotlight', 'newsletter-card', 'footer-columns']
  },
  {
    id: 'platform',
    title: 'Product platform',
    description: 'A multi-product company page with proof and plan comparison.',
    templates: ['topbar-marketing', 'hero-split', 'partners-dual-marquee', 'stats-row', 'products-suite', 'features-alternating', 'guides-walkthrough', 'pricing-compare', 'cta-split', 'footer-signoff']
  },
  {
    id: 'signed-out-landing',
    title: 'Signed-out landing',
    description: 'The default page a visitor sees before signing in: topbar, hero, call to action, footer.',
    templates: ['topbar-default', 'hero-default', 'cta-default', 'footer-default']
  }
]

const templatesById = new Map(sectionTemplates.map(template => [template.id, template]))

export const sectionTemplate = (id: string) => templatesById.get(id)
export const templatesOf = (kind: SectionKindId) => sectionTemplates.filter(template => template.kind === kind)

/** Templates whose kind or template text matches every word of the query. */
export function searchTemplates(query: string): SectionTemplate[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return sectionTemplates
  return sectionTemplates.filter(template => {
    const kind = sectionKind(template.kind)
    const haystack = [kind.label, kind.summary, ...kind.keywords, template.title, template.description].join(' ').toLowerCase()
    return words.every(word => haystack.includes(word))
  })
}
