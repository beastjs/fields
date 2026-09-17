export type SectionKindId =
  | 'topbar'
  | 'hero'
  | 'partners'
  | 'stats'
  | 'features'
  | 'guides'
  | 'products'
  | 'testimonials'
  | 'pricing'
  | 'faq'
  | 'team'
  | 'cta'
  | 'newsletter'
  | 'footer'

/** Where a section usually sits in a page's story; the library groups by stage and new sections insert in stage order. */
export type SectionStage = 'navigate' | 'introduce' | 'explain' | 'convince' | 'convert' | 'close'

export interface SectionKind {
  id: SectionKindId
  label: string
  /** Component name, and the file name under /src/sections/. */
  component: string
  stage: SectionStage
  summary: string
  keywords: string[]
}

export interface SectionTemplate {
  id: string
  kind: SectionKindId
  title: string
  description: string
  /**
   * A schematic thumbnail: one string per row of space-separated wireframe tokens (see studio/Wireframe.btsx).
   * A leading `^` centers the row.
   */
  wireframe: string[]
  /**
   * A Beast component with one root element carrying `data-section`. Colors derive from `currentColor` only, so a
   * section inherits the palette of whatever page hosts it.
   */
  source: string
}

export interface PageRecipe {
  id: string
  title: string
  description: string
  templates: string[]
}
