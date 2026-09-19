import type { SectionTemplate } from '../types'

export const footerTemplates: SectionTemplate[] = [
  {
    id: 'footer-default',
    kind: 'footer',
    title: 'Default',
    description: 'The standard closing bar: brand and tagline beside three link columns, with copyright and social links on the bottom row.',
    wireframe: ['logo gap xs xs xs', 'long gap xs xs xs', 'wide'],
    source: `setup
  const columns = [
    { title: 'Product', links: ['Features', 'Pricing', 'Changelog'] },
    { title: 'Company', links: ['About', 'Blog', 'Careers'] },
    { title: 'Legal', links: ['Privacy', 'Terms', 'Security'] }
  ];
  const socials = ['X', 'GitHub', 'LinkedIn'];

footer(data-section='footer' className='border-t border-current/10 px-4 pt-14 pb-8')
  div(className='mx-auto max-w-6xl')
    div(className='grid gap-10 md:grid-cols-[2fr_3fr]')
      div(className='flex flex-col gap-3')
        a(href='#' className='flex w-fit items-center gap-2.5')
          span(className='grid size-8 place-items-center rounded-xl border border-current/20 bg-current/10 text-[13px] font-bold') N
          span(className='text-[15px] font-semibold tracking-tight') Nova
        p(className='max-w-xs text-sm text-current/60') The calm workspace for people who would rather be building.
      nav(aria-label='Footer' className='grid grid-cols-3 gap-6')
        each column in columns key column.title
          div
            h3(className='text-sm font-semibold') #{column.title}
            ul(className='mt-4 grid gap-2.5 text-sm text-current/60')
              each link in column.links key link
                li
                  a(href='#' className='transition-colors hover:text-current') #{link}
    div(className='mt-12 flex flex-col items-center justify-between gap-4 border-t border-current/10 pt-6 text-sm text-current/60 sm:flex-row')
      p © #{new Date().getFullYear()} Nova Labs, Inc.
      ul(className='flex gap-5')
        each social in socials key social
          li
            a(href='#' className='transition-colors hover:text-current') #{social}
`
  },
  {
    id: 'footer-columns',
    kind: 'footer',
    title: 'Link columns',
    description: 'Brand and tagline beside four link columns, with copyright and social links underneath.',
    wireframe: ['logo line gap xs xs xs xs', 'long gap xs xs xs xs', 'wide'],
    source: `setup
  const columns = [
    { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
    { title: 'Company', links: ['About', 'Careers', 'Press', 'Contact'] },
    { title: 'Resources', links: ['Guides', 'Blog', 'Community', 'Help center'] },
    { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Cookies'] }
  ];
  const socials = ['X', 'LinkedIn', 'GitHub', 'YouTube'];

footer(data-section='footer' className='border-t border-current/10 px-4 pt-16 pb-8')
  div(className='mx-auto max-w-6xl')
    div(className='grid gap-10 lg:grid-cols-[2fr_3fr]')
      div(className='flex flex-col gap-4')
        a(href='#' className='flex items-center gap-2 font-semibold')
          span(className='grid size-7 place-items-center rounded-lg border border-current/20 bg-current/10 text-sm') N
          span Nova
        p(className='max-w-xs text-sm text-current/60') The calm, all-in-one workspace for founders and small teams.
      nav(aria-label='Footer' className='grid grid-cols-2 gap-8 sm:grid-cols-4')
        each column in columns key column.title
          div
            h3(className='text-sm font-semibold') #{column.title}
            ul(className='mt-4 grid gap-2.5 text-sm text-current/60')
              each link in column.links key link
                li
                  a(href='#' className='hover:text-current') #{link}
    div(className='mt-14 flex flex-col justify-between gap-4 border-t border-current/10 pt-8 text-sm text-current/60 sm:flex-row')
      p © #{new Date().getFullYear()} Nova Labs, Inc. All rights reserved.
      ul(className='flex gap-5')
        each social in socials key social
          li
            a(href='#' className='hover:text-current') #{social}
`
  },
  {
    id: 'footer-simple',
    kind: 'footer',
    title: 'Simple',
    description: 'A single tidy row with the brand, a few links, and copyright. Stacks neatly on phones.',
    wireframe: ['logo line gap xs xs xs gap line'],
    source: `setup
  const links = ['About', 'Pricing', 'Privacy', 'Terms'];

footer(data-section='footer' className='border-t border-current/10 px-4 py-8')
  div(className='mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm sm:flex-row')
    a(href='#' className='font-semibold') ▲ Nova
    nav(aria-label='Footer')
      ul(className='flex flex-wrap justify-center gap-x-6 gap-y-2 text-current/60')
        each link in links key link
          li
            a(href='#' className='hover:text-current') #{link}
    p(className='text-current/50') © #{new Date().getFullYear()} Nova
`
  },
  {
    id: 'footer-signoff',
    kind: 'footer',
    title: 'Big sign-off',
    description: 'A final call to action, contact and link rows, and an oversized wordmark to end on a high note.',
    wireframe: ['head gap btn', 'xs xs xs gap xs xs', 'huge'],
    source: `setup
  const links = ['Features', 'Pricing', 'Guides', 'Careers', 'Privacy'];

footer(data-section='footer' className='overflow-hidden border-t border-current/10 px-4 pt-20')
  div(className='mx-auto max-w-6xl')
    div(className='flex flex-col justify-between gap-8 md:flex-row md:items-end')
      h2(className='max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl') Let's build what's next, together.
      a(href='#' className='w-fit rounded-full border border-current/25 bg-current/10 px-6 py-3 font-medium hover:bg-current/15') hello@nova.example →
    div(className='mt-14 flex flex-col justify-between gap-6 border-t border-current/10 pt-8 text-sm text-current/60 sm:flex-row')
      nav(aria-label='Footer')
        ul(className='flex flex-wrap gap-x-6 gap-y-2')
          each link in links key link
            li
              a(href='#' className='hover:text-current') #{link}
      p © #{new Date().getFullYear()} Nova Labs, Inc.
    p(aria-hidden='true' className='mt-10 text-center text-[clamp(5rem,22vw,18rem)] leading-[0.8] font-semibold tracking-tighter text-current/10 select-none') nova
`
  }
]
