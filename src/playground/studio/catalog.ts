import type { PageRecipe, SectionKind, SectionKindId, SectionStage, SectionTemplate } from './types'
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

export type * from './types'

export const sectionStages: { id: SectionStage; label: string }[] = [
  { id: 'navigate', label: 'Navigate' },
  { id: 'introduce', label: 'Introduce' },
  { id: 'explain', label: 'Explain' },
  { id: 'convince', label: 'Convince' },
  { id: 'convert', label: 'Convert' },
  { id: 'close', label: 'Close' }
]

/**
 * Every section kind in natural page order. To add a section: create `sections/<kind>.ts`, add its id to
 * `SectionKindId`, and register the kind here and its templates below.
 */
export const sectionKinds: SectionKind[] = [
  { id: 'topbar', label: 'Topbar', component: 'Topbar', stage: 'navigate', summary: 'Brand and navigation at the top of every page.', keywords: ['navbar', 'header', 'menu', 'navigation'] },
  { id: 'hero', label: 'Hero', component: 'Hero', stage: 'introduce', summary: 'The first impression: your headline and main call to action.', keywords: ['headline', 'banner', 'above the fold', 'landing', 'waitlist'] },
  { id: 'partners', label: 'Partners marquee', component: 'Partners', stage: 'introduce', summary: 'Logos of customers, investors, or partners who trust you.', keywords: ['logos', 'clients', 'brands', 'marquee', 'social proof', 'investors'] },
  { id: 'stats', label: 'Stats', component: 'Stats', stage: 'introduce', summary: 'Headline numbers that prove traction.', keywords: ['metrics', 'numbers', 'kpi', 'traction'] },
  { id: 'features', label: 'Features', component: 'Features', stage: 'explain', summary: 'What your product does and why it matters.', keywords: ['benefits', 'capabilities', 'bento', 'grid'] },
  { id: 'guides', label: 'Guides', component: 'Guides', stage: 'explain', summary: 'How it works, onboarding steps, and helpful resources.', keywords: ['how it works', 'steps', 'tutorial', 'docs', 'resources', 'onboarding'] },
  { id: 'products', label: 'Products', component: 'Products', stage: 'explain', summary: 'Showcase products, plans, or a shoppable catalog.', keywords: ['shop', 'store', 'catalog', 'ecommerce', 'suite'] },
  { id: 'testimonials', label: 'Testimonials', component: 'Testimonials', stage: 'convince', summary: 'Customer quotes and success stories.', keywords: ['reviews', 'quotes', 'social proof', 'customers'] },
  { id: 'pricing', label: 'Pricing', component: 'Pricing', stage: 'convince', summary: 'Plans and prices that make buying easy.', keywords: ['plans', 'tiers', 'cost', 'subscription', 'compare'] },
  { id: 'faq', label: 'FAQ', component: 'Faq', stage: 'convince', summary: 'Answers to the questions that block a sign-up.', keywords: ['questions', 'answers', 'help', 'accordion'] },
  { id: 'team', label: 'Team', component: 'Team', stage: 'convince', summary: 'The people behind the product.', keywords: ['about', 'founders', 'people', 'story', 'letter'] },
  { id: 'cta', label: 'Call to action', component: 'CallToAction', stage: 'convert', summary: 'A final nudge to sign up, book a demo, or buy.', keywords: ['cta', 'signup', 'banner', 'trial', 'demo'] },
  { id: 'newsletter', label: 'Newsletter', component: 'Newsletter', stage: 'convert', summary: 'Collect emails for updates and launches.', keywords: ['email', 'subscribe', 'waitlist', 'updates', 'signup'] },
  { id: 'footer', label: 'Footer', component: 'Footer', stage: 'close', summary: 'Links, legal, and contact details at the bottom.', keywords: ['links', 'copyright', 'legal', 'bottom'] }
]

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
  }
]

const kindsById = new Map(sectionKinds.map(kind => [kind.id, kind]))
const templatesById = new Map(sectionTemplates.map(template => [template.id, template]))

export const sectionKind = (id: SectionKindId) => kindsById.get(id)!
export const sectionTemplate = (id: string) => templatesById.get(id)
export const templatesOf = (kind: SectionKindId) => sectionTemplates.filter(template => template.kind === kind)
export const kindOrder = (kind: SectionKindId) => sectionKinds.findIndex(candidate => candidate.id === kind)

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
