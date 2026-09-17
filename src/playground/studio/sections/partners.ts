import type { SectionTemplate } from '../types'

export const partnersTemplates: SectionTemplate[] = [
  {
    id: 'partners-marquee',
    kind: 'partners',
    title: 'Scrolling logos',
    description: 'An endless, edge-faded logo marquee that pauses on hover and respects reduced motion.',
    wireframe: ['^ line', 'logo line logo line logo line logo line'],
    source: `setup
  const partners = ['Northwind', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark & Co', 'Wayne Labs', 'Vandelay'];

section(data-section='partners' className='py-14')
  p(className='mb-8 px-4 text-center text-sm text-current/60') Trusted by fast-moving teams at
  div(className='group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]')
    div(className='flex w-max animate-[studio-marquee_36s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none')
      each partner, index in [...partners, ...partners] key index
        span(aria-hidden={index >= partners.length} className='flex items-center gap-2 px-8 text-xl font-semibold tracking-tight whitespace-nowrap text-current/50')
          span(className='grid size-6 place-items-center rounded-md border border-current/25 text-xs') #{partner[0]}
          span #{partner}
`
  },
  {
    id: 'partners-dual-marquee',
    kind: 'partners',
    title: 'Two-way marquee',
    description: 'Two rows of pill-shaped logos drifting in opposite directions under a short headline.',
    wireframe: ['^ title', 'pill pill pill pill pill pill', 'gap pill pill pill pill pill'],
    source: `setup
  const rows = [
    ['Northwind', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Soylent'],
    ['Stark & Co', 'Wayne Labs', 'Vandelay', 'Tyrell', 'Cyberdyne', 'Aperture']
  ];

section(data-section='partners' className='py-16')
  h2(className='mb-10 px-4 text-center text-2xl font-semibold tracking-tight') Powering 900+ companies worldwide
  div(className='grid gap-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]')
    each row, rowIndex in rows key rowIndex
      div(className='overflow-hidden')
        div(className={'flex w-max gap-4 pr-4 motion-reduce:animate-none ' + (rowIndex % 2 ? 'animate-[studio-marquee_44s_linear_infinite_reverse]' : 'animate-[studio-marquee_40s_linear_infinite]')})
          each name, index in [...row, ...row] key index
            span(aria-hidden={index >= row.length} className='rounded-full border border-current/15 bg-current/5 px-5 py-2 text-sm font-medium whitespace-nowrap text-current/70') #{name}
`
  },
  {
    id: 'partners-grid',
    kind: 'partners',
    title: 'Logo wall',
    description: 'A calm, static grid of partner tiles with a caption — ideal for investors and press mentions.',
    wireframe: ['^ line', 'card card card card', 'card card card card'],
    source: `setup
  const partners = ['Northwind', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark & Co', 'Wayne Labs', 'Vandelay'];

section(data-section='partners' className='px-4 py-16')
  div(className='mx-auto max-w-5xl')
    p(className='mb-8 text-center text-sm tracking-widest text-current/50 uppercase') Backed by and built with
    ul(className='grid grid-cols-2 overflow-hidden rounded-2xl border-t border-l border-current/10 sm:grid-cols-4')
      each partner in partners key partner
        li(className='grid h-24 place-items-center border-r border-b border-current/10 text-lg font-semibold tracking-tight text-current/60 hover:bg-current/5 hover:text-current') #{partner}
`
  }
]
