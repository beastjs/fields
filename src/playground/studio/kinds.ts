import type { SectionKind, SectionKindId, SectionStage } from './types'

/**
 * The section taxonomy: which kinds exist, what each is for, and where it sits in a page's story.
 *
 * This stays in code while presets live in Convex. A kind implies a component name and a stage that page
 * composition depends on at build time, so adding one is a code change; adding a preset is not. Keeping it out of
 * `catalog.ts` also keeps the built-in template sources — which are seed material only — out of the app bundle.
 */

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

const kindsById = new Map(sectionKinds.map(kind => [kind.id, kind]))

export const sectionKind = (id: SectionKindId) => kindsById.get(id)!
export const kindOrder = (kind: SectionKindId) => sectionKinds.findIndex(candidate => candidate.id === kind)
