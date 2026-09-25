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
  },
  {
    id: 'cta-shout',
    kind: 'cta',
    title: 'Shouting marquee',
    description: 'A full-width band of giant uppercase type scrolling endlessly between heavy rules, with a spinning mark.',
    wireframe: ['huge huge huge', '^ line line'],
    source: `setup
  const loop = [0, 1, 2, 3, 4, 5];

section(data-section='cta' className='overflow-hidden border-y-2 border-current')
  a(role='link' aria-disabled='true' aria-label='Start something strange' className='group block py-8')
    span(aria-hidden='true' className='flex w-max animate-[studio-marquee_24s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none')
      each index in loop key index
        span(className='flex items-center gap-8 px-8 text-[clamp(3rem,9vw,8rem)] leading-none font-black tracking-[-0.05em] whitespace-nowrap uppercase transition-colors group-hover:text-[var(--studio-accent)]')
          span Start something strange
          span(className='inline-block animate-[studio-spin_6s_linear_infinite] text-[var(--studio-accent)] group-hover:text-current motion-reduce:animate-none') ✺
  p(className='flex flex-wrap justify-center gap-x-6 gap-y-1 border-t-2 border-current px-4 py-3 font-mono text-xs uppercase')
    span hello@rawform.studio
    span(className='text-current/60') Commissions open for spring
`
  },
  {
    id: 'cta-stamp',
    kind: 'cta',
    title: 'Rotating stamp',
    description: 'A circular text stamp that spins around an accent button, beside a serif invitation.',
    wireframe: ['avatar head', 'gap long'],
    source: `section(data-section='cta' className='px-4 py-24')
  div(className='mx-auto flex max-w-5xl flex-col items-center gap-10 text-center sm:flex-row sm:text-left')
    a(role='link' aria-disabled='true' aria-label='Get in touch' className='group relative grid size-48 shrink-0 place-items-center')
      svg(aria-hidden='true' viewBox='0 0 200 200' className='absolute inset-0 size-full animate-[studio-spin_18s_linear_infinite] motion-reduce:animate-none')
        defs
          path#cta-stamp-circle(d='M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0' fill='none')
        text(fill='currentColor' className='font-mono text-[14px] tracking-[0.28em] uppercase')
          textPath(href='#cta-stamp-circle' textLength='486' lengthAdjust='spacing') Make it weird · Make it now ·
      span(className='grid size-20 place-items-center rounded-full bg-[var(--studio-accent)]/25 ring-2 ring-[var(--studio-accent)] text-3xl transition-transform duration-500 group-hover:rotate-45') ↗
    div(className='flex flex-col gap-4')
      h2(className='font-serif text-5xl leading-[0.95] italic sm:text-6xl') Got a half-finished idea?
      p(className='max-w-md text-lg text-current/70') Bring it here. We are at our best in the part where nobody knows what it is yet.
`
  },
  {
    id: 'cta-prost',
    kind: 'cta',
    title: 'Ein Prosit',
    description: 'Toasts in ten languages drift behind a giant stretched headline and a Prost button that clinks two steins and counts.',
    wireframe: ['huge huge huge', '^ huge', '^ btn', '^ line'],
    source: `import { useState } from 'octane'

setup
  const [prosts, setProsts] = useState(0);
  const toasts = ['Prost', 'Cheers', 'Salute', 'Skål', 'Kanpai', 'Sláinte', 'Santé', 'Na zdrowie', 'Saúde', 'Gānbēi'];
  const replies = ['The band approves.', 'Your neighbour is now your best friend.', 'Somebody order a Brezn.', 'Pace yourself.', 'One more Prosit!'];
  const tilt = prosts % 2 ? 16 : -10;

section(data-section='cta' className='relative overflow-hidden border-y-8 border-double border-current py-24')
  div(aria-hidden='true' className='pointer-events-none absolute inset-0 flex flex-col justify-center gap-4 opacity-20 select-none')
    each row in [0, 1, 2] key row
      div(className={'flex w-max motion-reduce:animate-none ' + (row % 2 ? 'animate-[studio-marquee_40s_linear_infinite_reverse]' : 'animate-[studio-marquee_32s_linear_infinite]')})
        each toast, index in [...toasts, ...toasts] key index
          span(className='px-6 text-7xl font-black tracking-tighter whitespace-nowrap uppercase italic') #{toast}!
  div(className='relative mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 text-center')
    h2(className='origin-bottom scale-y-[1.35] text-[clamp(4rem,13vw,9rem)] leading-[0.85] font-black tracking-[-0.06em] uppercase') Ein Prosit!
    p(className='max-w-md text-xl font-medium') Every twenty minutes the band plays the toast, and ten thousand steins go up at once. Practise here.
    button(type='button' onClick={() => setProsts(count => count + 1)} className='group flex items-center gap-4 rounded-full border-4 border-current bg-[var(--studio-accent)]/40 py-3 pr-8 pl-4 text-2xl font-black uppercase shadow-[0_8px_0_currentColor] transition-all hover:-translate-y-1 active:translate-y-2 active:shadow-none')
      span(aria-hidden='true' className='flex items-end gap-0.5')
        span(className='h-8 w-6 origin-bottom rounded-b-md border-[3px] border-current bg-current/20 transition-transform duration-200' style={{ transform: 'rotate(' + tilt + 'deg)' }})
        span(className='h-8 w-6 origin-bottom rounded-b-md border-[3px] border-current bg-current/20 transition-transform duration-200' style={{ transform: 'rotate(' + -tilt + 'deg)' }})
      span Prost!
    p(role='status' aria-live='polite' className='min-h-7 font-mono text-sm font-bold uppercase') #{prosts === 0 ? 'Nobody has clinked yet.' : prosts + (prosts === 1 ? ' Prost' : ' Prosts') + ' — ' + replies[(prosts - 1) % replies.length]}
`
  }
]
