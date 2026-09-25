import type { SectionTemplate } from '../types'

export const ctaTemplates: SectionTemplate[] = [
  {
    id: 'cta-default',
    kind: 'cta',
    title: 'Default',
    description: 'The standard closing invitation: a centered card with a headline, a primary action, and a quiet reassurance underneath.',
    wireframe: ['^ head', '^ long', '^ btn ghost', '^ line'],
    source: `section(data-section='cta' className='px-4 py-20 sm:py-24')
  div(className='relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-current/15 bg-current/5 px-6 py-16 text-center sm:px-16')
    div(aria-hidden='true' className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,currentColor,transparent_70%)] opacity-[0.08]')
    div(className='relative flex flex-col items-center gap-6')
      h2(className='max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl') Start building in the next five minutes
      p(className='max-w-lg text-current/70') Create an account and your first project is ready before your coffee lands.
      div(className='flex flex-wrap justify-center gap-3')
        a(role='link' aria-disabled='true' className='rounded-xl border border-current/25 bg-current/15 px-6 py-3 font-medium transition-colors hover:bg-current/20') Create your account
        a(role='link' aria-disabled='true' className='rounded-xl border border-current/15 px-6 py-3 text-current/80 transition-colors hover:bg-current/5') Talk to us
      p(className='text-sm text-current/50') Free forever for solo projects. No credit card required.
`
  },
  {
    id: 'cta-banner',
    kind: 'cta',
    title: 'Banner',
    description: 'A framed, centered invitation with a headline and two actions to close the pitch.',
    wireframe: ['^ head', '^ long', '^ btn ghost'],
    source: `section(data-section='cta' className='px-4 py-20')
  div(className='relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-current/15 bg-current/5 px-6 py-16 text-center sm:px-16')
    div(aria-hidden='true' className='absolute inset-0 bg-[radial-gradient(circle,currentColor_1px,transparent_1.5px)] bg-size-[18px_18px] opacity-10 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]')
    div(className='relative flex flex-col items-center gap-6')
      h2(className='max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl') Ready to launch something great?
      p(className='max-w-xl text-lg text-current/70') Join thousands of founders building faster with Nova. Free to start, no credit card needed.
      div(className='flex flex-wrap justify-center gap-3')
        a(role='link' aria-disabled='true' className='rounded-lg border border-current/25 bg-current/15 px-6 py-3 font-medium hover:bg-current/20') Get started free
        a(role='link' aria-disabled='true' className='rounded-lg border border-current/15 px-6 py-3 hover:bg-current/5') Talk to sales
`
  },
  {
    id: 'cta-split',
    kind: 'cta',
    title: 'Split strip',
    description: 'A full-width band with the pitch on one side and actions on the other, between hairlines.',
    wireframe: ['title gap btn ghost', 'long gap'],
    source: `section(data-section='cta' className='border-y border-current/10 px-4 py-14')
  div(className='mx-auto flex max-w-6xl flex-col justify-between gap-8 md:flex-row md:items-center')
    div
      h2(className='text-2xl font-semibold tracking-tight sm:text-3xl') Start your 14-day free trial
      p(className='mt-2 text-current/70') Full access to every feature. Set up in minutes, cancel anytime.
    div(className='flex shrink-0 flex-wrap gap-3')
      a(role='link' aria-disabled='true' className='rounded-lg border border-current/25 bg-current/15 px-5 py-2.5 font-medium hover:bg-current/20') Start free trial
      a(role='link' aria-disabled='true' className='rounded-lg px-5 py-2.5 text-current/70 hover:bg-current/5 hover:text-current') Book a demo →
`
  }
]
