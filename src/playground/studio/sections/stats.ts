import type { SectionTemplate } from '../types'

export const statsTemplates: SectionTemplate[] = [
  {
    id: 'stats-row',
    kind: 'stats',
    title: 'Metric row',
    description: 'Four headline numbers separated by hairlines. Great right under a hero.',
    wireframe: ['num gap num gap num gap num', 'line gap line gap line gap line'],
    source: `setup
  const stats = [
    { value: '12k+', label: 'Teams onboarded' },
    { value: '99.99%', label: 'Uptime, last 12 months' },
    { value: '4.9/5', label: 'Average review' },
    { value: '38%', label: 'Faster launches' }
  ];

section(data-section='stats' className='px-4 py-16')
  dl(className='mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4')
    each stat in stats key stat.label
      div(className='flex flex-col gap-2 border-l border-current/15 pl-5')
        dt(className='order-2 text-sm text-current/60') #{stat.label}
        dd(className='order-1 text-4xl font-semibold tracking-tight sm:text-5xl') #{stat.value}
`
  },
  {
    id: 'stats-story',
    kind: 'stats',
    title: 'Metrics with story',
    description: 'A short narrative on the left and a two-by-two grid of metric cards on the right.',
    wireframe: ['title gap card card', 'long gap card card'],
    source: `setup
  const stats = [
    { value: '$2.4M', label: 'Saved for customers', note: 'Across automated workflows in 2025' },
    { value: '6 min', label: 'Median setup time', note: 'From sign-up to first workflow' },
    { value: '140', label: 'Countries', note: 'Teams working with Nova every day' },
    { value: '24/7', label: 'Human support', note: 'Real people, real answers' }
  ];

section(data-section='stats' className='px-4 py-20')
  div(className='mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[2fr_3fr]')
    div(className='flex flex-col gap-4')
      p(className='text-sm font-medium tracking-wide text-current/60 uppercase') By the numbers
      h2(className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl') Small teams, outsized results
      p(className='text-lg text-current/70') We measure success by the time our customers get back. Here's what that looks like so far.
    dl(className='grid gap-4 sm:grid-cols-2')
      each stat in stats key stat.label
        div(className='rounded-2xl border border-current/10 bg-current/5 p-6')
          dt(className='text-sm font-medium') #{stat.label}
          dd(className='mt-3 text-4xl font-semibold tracking-tight') #{stat.value}
          dd(className='mt-2 text-sm text-current/60') #{stat.note}
`
  },
  {
    id: 'stats-giant',
    kind: 'stats',
    title: 'Outlined numerals',
    description: 'Three colossal outlined numbers that fill with the accent colour when you hover them.',
    wireframe: ['xs xs xs', 'huge huge huge'],
    source: `setup
  const stats = [
    { value: '212', label: 'Things made by hand' },
    { value: '38', label: 'Cities we have shown in' },
    { value: '∞', label: 'Ideas still in the drawer' }
  ];

section(data-section='stats' className='overflow-hidden px-4 py-20 sm:px-8')
  dl(className='mx-auto grid max-w-7xl gap-y-10 md:grid-cols-3')
    each stat in stats key stat.label
      div(className='group flex flex-col-reverse border-current/20 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0')
        dt(className='font-mono text-xs tracking-widest text-current/60 uppercase') #{stat.label}
        dd(className='text-[clamp(5rem,14vw,11rem)] leading-[0.85] font-black tracking-[-0.06em] transition-colors duration-500 [-webkit-text-fill-color:transparent] [-webkit-text-stroke:2px_currentColor] group-hover:text-[var(--studio-accent)] group-hover:[-webkit-text-fill-color:var(--studio-accent)]') #{stat.value}
`
  },
  {
    id: 'stats-beer',
    kind: 'stats',
    title: 'By the Maß',
    description: 'Four steins that fill up to their number when the page loads, each crowned with foam.',
    wireframe: ['^ huge', 'tall tall tall tall', 'num num num num'],
    source: `setup
  const stats = [
    { value: '7M', label: 'Maß poured last year', fill: 90 },
    { value: '16', label: 'days of Gemütlichkeit', fill: 62 },
    { value: '6M', label: 'visitors from everywhere', fill: 78 },
    { value: '0', label: 'tables stood on (benches only!)', fill: 20 }
  ];

section(data-section='stats' className='px-4 py-24 sm:px-8')
  div(className='mx-auto max-w-6xl')
    h2(className='mb-14 text-center origin-bottom scale-y-125 text-5xl font-black tracking-[-0.05em] uppercase sm:text-7xl') By the Maß
    dl(className='grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4')
      each stat in stats key stat.label
        div(className='group flex flex-col items-center gap-5 text-center')
          div(aria-hidden='true' className='relative mt-4 h-52 w-32 overflow-hidden rounded-t-md rounded-b-3xl border-[6px] border-current')
            div(className='absolute inset-x-0 bottom-0 animate-[studio-fill_1.8s_cubic-bezier(.2,.8,.2,1)_both] bg-current/25 motion-reduce:animate-none' style={{ height: stat.fill + '%' }})
              span(className='absolute inset-x-0 -top-3 h-6 rounded-full bg-[var(--studio-accent)]')
          dd(className='order-first origin-bottom scale-y-125 text-7xl leading-none font-black tracking-[-0.06em] transition-transform group-hover:scale-y-150') #{stat.value}
          dt(className='max-w-40 font-mono text-xs font-bold uppercase') #{stat.label}
`
  }
]
