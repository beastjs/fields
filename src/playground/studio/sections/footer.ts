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
        a(role='link' aria-disabled='true' className='flex w-fit items-center gap-2.5')
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
                  a(role='link' aria-disabled='true' className='transition-colors hover:text-current') #{link}
    div(className='mt-12 flex flex-col items-center justify-between gap-4 border-t border-current/10 pt-6 text-sm text-current/60 sm:flex-row')
      p © #{new Date().getFullYear()} Nova Labs, Inc.
      ul(className='flex gap-5')
        each social in socials key social
          li
            a(role='link' aria-disabled='true' className='transition-colors hover:text-current') #{social}
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
        a(role='link' aria-disabled='true' className='flex items-center gap-2 font-semibold')
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
                  a(role='link' aria-disabled='true' className='hover:text-current') #{link}
    div(className='mt-14 flex flex-col justify-between gap-4 border-t border-current/10 pt-8 text-sm text-current/60 sm:flex-row')
      p © #{new Date().getFullYear()} Nova Labs, Inc. All rights reserved.
      ul(className='flex gap-5')
        each social in socials key social
          li
            a(role='link' aria-disabled='true' className='hover:text-current') #{social}
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
    a(role='link' aria-disabled='true' className='font-semibold') ▲ Nova
    nav(aria-label='Footer')
      ul(className='flex flex-wrap justify-center gap-x-6 gap-y-2 text-current/60')
        each link in links key link
          li
            a(role='link' aria-disabled='true' className='hover:text-current') #{link}
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
      a(role='link' aria-disabled='true' className='w-fit rounded-full border border-current/25 bg-current/10 px-6 py-3 font-medium hover:bg-current/15') hello@nova.example →
    div(className='mt-14 flex flex-col justify-between gap-6 border-t border-current/10 pt-8 text-sm text-current/60 sm:flex-row')
      nav(aria-label='Footer')
        ul(className='flex flex-wrap gap-x-6 gap-y-2')
          each link in links key link
            li
              a(role='link' aria-disabled='true' className='hover:text-current') #{link}
      p © #{new Date().getFullYear()} Nova Labs, Inc.
    p(aria-hidden='true' className='mt-10 text-center text-[clamp(5rem,22vw,18rem)] leading-[0.8] font-semibold tracking-tighter text-current/10 select-none') nova
`
  },
  {
    id: 'footer-wordmark',
    kind: 'footer',
    title: 'Giant wordmark',
    description: 'Link columns above a page-wide wordmark that bleeds off the bottom edge.',
    wireframe: ['text line line', 'xs gap xs', 'huge'],
    source: `setup
  const groups = [
    { title: 'Studio', links: ['About', 'Manifesto', 'Careers'] },
    { title: 'Elsewhere', links: ['Instagram', 'Are.na', 'Newsletter'] }
  ];

section(data-section='footer' className='overflow-hidden px-4 pt-16 sm:px-8')
  div(className='mx-auto grid max-w-7xl gap-10 sm:grid-cols-[2fr_1fr_1fr]')
    p(className='max-w-sm text-lg leading-snug') Made with stubbornness, good coffee, and the occasional small miracle.
    each group in groups key group.title
      div
        h2(className='mb-3 font-mono text-[11px] tracking-widest text-current/50 uppercase') #{group.title}
        ul(className='grid gap-1.5')
          each link in group.links key link
            li
              a(role='link' aria-disabled='true' className='inline-block transition-all hover:translate-x-2 hover:text-[var(--studio-accent)]') #{link}
  div(className='mx-auto mt-16 flex max-w-7xl justify-between border-t border-current/20 py-4 font-mono text-[10px] text-current/50 uppercase')
    span © 2026 — all rights reversed
    span 52.37° N · 4.89° E
  p(aria-hidden='true' className='-mb-[0.18em] text-center text-[clamp(3rem,12vw,14rem)] leading-[0.8] font-black tracking-[-0.08em] whitespace-nowrap uppercase select-none') Stay curious
`
  },
  {
    id: 'footer-colophon',
    kind: 'footer',
    title: 'Colophon',
    description: 'A book-like sign-off: an italic colophon note, typesetting credits, quiet links, and a fleuron.',
    wireframe: ['title line line', 'text xs xs', '^ line'],
    source: `setup
  const colophon = [
    { label: 'Typeset in', value: 'A serif and a monospace' },
    { label: 'Edited by', value: 'Aurelio Mance' },
    { label: 'Published from', value: 'A small room with a large window' }
  ];
  const links = ['Archive', 'Contributors', 'Stockists', 'Write to us'];

section(data-section='footer' className='px-4 py-16 sm:px-8')
  div(className='mx-auto grid max-w-6xl gap-10 border-t-4 border-double border-current/60 pt-10 md:grid-cols-[2fr_1fr_1fr]')
    div
      p(className='font-serif text-3xl italic') Colophon
      p(className='mt-4 max-w-md font-serif text-current/70') This site was set by hand in a small room with a large window. It has no cookies, no tracking, and no opinion about the size of your screen.
    dl(className='grid content-start gap-4 text-sm')
      each entry in colophon key entry.label
        div
          dt(className='font-mono text-[10px] tracking-widest text-current/50 uppercase') #{entry.label}
          dd #{entry.value}
    nav(aria-label='Footer' className='grid content-start gap-2 text-sm')
      each link in links key link
        a(role='link' aria-disabled='true' className='transition-colors hover:text-[var(--studio-accent)] hover:italic') #{link}
  p(className='mx-auto mt-12 max-w-6xl text-center font-mono text-[10px] tracking-[0.3em] text-current/40 uppercase') ❦ Printed on light, 2026 ❦
`
  },
  {
    id: 'footer-lozenge',
    kind: 'footer',
    title: 'Lozenge sign-off',
    description: 'A Bavarian lozenge band, a giant italic year mark, opening hours, quick links, and a responsible-drinking line.',
    wireframe: ['line line line line line line line line', 'huge gap line', 'text gap line', 'xs gap xs'],
    source: `setup
  const links = ['Getting there', 'Lost & found', 'Accessibility', 'Press', 'Contact'];

section(data-section='footer' className='overflow-hidden')
  div(aria-hidden='true' className='h-14 border-y-4 border-current bg-[repeating-conic-gradient(from_45deg,var(--studio-accent)_0_25%,transparent_0_50%)] bg-[size:40px_24px]')
  div(className='mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-[2fr_1fr]')
    div
      p(className='font-serif text-[clamp(4rem,14vw,10rem)] leading-[0.8] font-black tracking-tight italic') Wiesn ’26
      p(className='mt-6 max-w-md text-lg') See you under the Bavaria statue. Tents open at 10:00 on weekdays and 09:00 at weekends; last orders at 22:30.
    nav(aria-label='Footer' className='grid content-start gap-2 text-xl font-black uppercase')
      each link in links key link
        a(role='link' aria-disabled='true' className='inline-block transition-transform hover:translate-x-2 hover:-rotate-2') #{link} →
  div(className='flex flex-wrap justify-between gap-2 border-t-4 border-double border-current px-4 py-4 font-mono text-[11px] font-bold uppercase sm:px-8')
    span Drink water between every Maß · 18+ for beer · Take the U-Bahn home
    span Brewed with Gemütlichkeit
`
  }
]
