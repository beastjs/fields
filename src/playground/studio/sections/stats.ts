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
  }
]
