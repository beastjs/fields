import type { SectionTemplate } from '../types'

export const testimonialsTemplates: SectionTemplate[] = [
  {
    id: 'testimonials-wall',
    kind: 'testimonials',
    title: 'Quote wall',
    description: 'A masonry wall of short customer quotes with names and roles — social proof at a glance.',
    wireframe: ['^ title', 'card tall card', 'tall card tall'],
    source: `setup
  const quotes = [
    { quote: 'We replaced four tools with Nova in a week. Our Monday meetings are now twenty minutes shorter.', name: 'Amara Okafor', role: 'COO, Lattice & Loom' },
    { quote: 'The onboarding felt like it was designed by someone who has actually run a startup.', name: 'Jonas Berg', role: 'Founder, Fjord' },
    { quote: 'Our activation rate jumped 31% after we rebuilt onboarding with Nova journeys.', name: 'Priya Raman', role: 'Head of Growth, Quill' },
    { quote: 'Support answered in four minutes. On a Sunday.', name: 'Diego Alvarez', role: 'CTO, Brightpath' },
    { quote: 'It is the rare product that makes the whole team faster, not just the power users. Everyone from sales to engineering lives in it now.', name: 'Mei Tanaka', role: 'VP Operations, Kinso' },
    { quote: 'Setup took one coffee. Seriously.', name: 'Sam Carter', role: 'Indie founder' }
  ];
  const initials = (name: string) => name.split(' ').map(part => part[0]).join('');

section(data-section='testimonials' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    h2(className='mx-auto mb-12 max-w-2xl text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl') Founders talk. We listen — and blush.
    div(className='gap-4 sm:columns-2 lg:columns-3')
      each item in quotes key item.name
        figure(className='mb-4 break-inside-avoid rounded-2xl border border-current/10 p-6')
          blockquote(className='leading-relaxed') “#{item.quote}”
          figcaption(className='mt-5 flex items-center gap-3')
            span(className='grid size-9 place-items-center rounded-full border border-current/20 bg-current/10 text-xs font-medium') #{initials(item.name)}
            span
              span(className='block text-sm font-medium') #{item.name}
              span(className='block text-xs text-current/60') #{item.role}
`
  },
  {
    id: 'testimonials-spotlight',
    kind: 'testimonials',
    title: 'Spotlight quote',
    description: 'One big, centered customer story with a rating, avatar, and the result that matters.',
    wireframe: ['^ xs xs xs xs xs', '^ head', '^ long', '^ avatar line'],
    source: `section(data-section='testimonials' className='px-4 py-24 sm:py-32')
  figure(className='mx-auto flex max-w-3xl flex-col items-center gap-8 text-center')
    p(aria-label='Rated 5 out of 5' className='text-lg tracking-[0.3em]') ★★★★★
    blockquote(className='text-2xl leading-snug font-medium tracking-tight text-balance sm:text-4xl') “Nova paid for itself in the first month. We shipped our relaunch two weeks early and doubled trial sign-ups.”
    figcaption(className='flex items-center gap-4')
      span(className='grid size-12 place-items-center rounded-full border border-current/20 bg-current/10 font-medium') LN
      span(className='text-left')
        span(className='block font-semibold') Lena Novak
        span(className='block text-sm text-current/60') Co-founder & CEO, Orbitly
    p(className='rounded-full border border-current/15 px-4 py-1.5 text-sm text-current/70') 2× trial sign-ups in 30 days
`
  },
  {
    id: 'testimonials-carousel',
    kind: 'testimonials',
    title: 'Carousel',
    description: 'Customer stories one at a time, with previous / next controls and position dots.',
    wireframe: ['dot gap head gap dot', '^ line', '^ xs xs xs'],
    source: `import { useState } from 'octane'

setup
  const stories = [
    { quote: 'We launched in 11 countries without hiring a single extra engineer.', name: 'Ines Duarte', role: 'Founder, Maré' },
    { quote: 'Nova is the first tool our designers and developers both love. That never happens.', name: 'Tom Achebe', role: 'Product Lead, Parcel' },
    { quote: 'Our churn dropped by a third once we could finally see where customers got stuck.', name: 'Hana Kim', role: 'CEO, Tidewater' }
  ];
  const [index, setIndex] = useState(0);
  const move = (step: number) => setIndex((index + step + stories.length) % stories.length);
  const story = stories[index];

section(data-section='testimonials' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-4xl rounded-3xl border border-current/10 bg-current/5 px-6 py-12 sm:px-16')
    div(className='flex items-center gap-4')
      button(type='button' aria-label='Previous story' onClick={() => move(-1)} className='grid size-10 shrink-0 place-items-center rounded-full border border-current/15 hover:bg-current/10') ←
      figure(aria-live='polite' className='flex flex-1 flex-col items-center gap-6 text-center')
        blockquote(className='text-xl leading-relaxed font-medium text-balance sm:text-2xl') “#{story.quote}”
        figcaption
          span(className='block font-semibold') #{story.name}
          span(className='block text-sm text-current/60') #{story.role}
      button(type='button' aria-label='Next story' onClick={() => move(1)} className='grid size-10 shrink-0 place-items-center rounded-full border border-current/15 hover:bg-current/10') →
    div(className='mt-8 flex justify-center gap-2')
      each item, dot in stories key item.name
        button(type='button' aria-label={'Show story ' + (dot + 1)} aria-current={dot === index} onClick={() => setIndex(dot)} className={'h-1.5 rounded-full transition-all ' + (dot === index ? 'w-6 bg-current/60' : 'w-1.5 bg-current/20')})
`
  },
  {
    id: 'testimonials-pullquote',
    kind: 'testimonials',
    title: 'Giant pull quote',
    description: 'One enormous serif quotation under a huge accent quote mark, signed with a conic-gradient portrait.',
    wireframe: ['num gap', 'huge', 'huge', 'avatar line'],
    source: `section(data-section='testimonials' className='relative overflow-hidden px-4 py-24 sm:px-8 sm:py-32')
  span(aria-hidden='true' className='pointer-events-none absolute -top-16 left-0 font-serif text-[22rem] leading-none text-[var(--studio-accent)] opacity-25 select-none sm:-top-24 sm:text-[32rem]') “
  figure(className='relative mx-auto max-w-5xl')
    blockquote(className='font-serif text-3xl leading-[1.15] font-light text-balance sm:text-5xl lg:text-6xl')
      p It changed how our whole studio talks about work. We stopped asking whether a thing was finished and started asking whether it was alive.
    figcaption(className='mt-10 flex items-center gap-4')
      span(aria-hidden='true' className='size-14 animate-[studio-spin_12s_linear_infinite] rounded-full bg-[conic-gradient(var(--studio-accent),currentColor,var(--studio-accent))] opacity-80 motion-reduce:animate-none')
      span
        span(className='block font-medium') Marguerite Ashdown
        span(className='block text-sm text-current/60') Creative director, Hollow & Hue
`
  }
]
