import type { SectionTemplate } from '../types'

export const heroTemplates: SectionTemplate[] = [
  {
    id: 'hero-default',
    kind: 'hero',
    title: 'Default',
    description: 'The standard opening: an announcement pill, a bold headline, a primary and secondary action, and a row of reassurances.',
    wireframe: ['^ pill', '^ head', '^ long', '^ btn ghost', '^ xs xs xs'],
    source: `setup
  const reassurances = ['Free to start', 'No credit card', 'Set up in minutes'];

section(data-section='hero' className='relative overflow-hidden px-4 py-24 sm:py-32')
  div(aria-hidden='true' className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,currentColor,transparent_65%)] opacity-[0.08]')
  div(className='relative mx-auto flex max-w-3xl flex-col items-center gap-7 text-center')
    span(className='inline-flex items-center gap-2 rounded-full border border-current/15 bg-current/5 py-1 pr-3 pl-1 text-xs text-current/70')
      span(className='rounded-full bg-current/10 px-2 py-0.5 font-medium text-current') New
      span Nova 2.0 is out today
    h1(className='text-4xl font-semibold tracking-tight text-balance sm:text-6xl') Everything you need to ship your next idea
    p(className='max-w-xl text-lg text-pretty text-current/70') Nova gives you the workspace, the tools, and the momentum to get from a rough sketch to something real — in an afternoon.
    div(className='flex flex-wrap items-center justify-center gap-3')
      a(role='link' aria-disabled='true' className='rounded-xl border border-current/25 bg-current/15 px-6 py-3 font-medium transition-colors hover:bg-current/20') Get started free
      a(role='link' aria-disabled='true' className='rounded-xl border border-current/15 px-6 py-3 text-current/80 transition-colors hover:bg-current/5') Take the tour →
    ul(className='flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-current/60')
      each item in reassurances key item
        li(className='flex items-center gap-1.5')
          span(aria-hidden='true') ✓
          span #{item}
`
  },
  {
    id: 'hero-centered',
    kind: 'hero',
    title: 'Centered launch',
    description: 'An announcement pill, a bold headline, two calls to action, and a line of social proof.',
    wireframe: ['^ pill', '^ head', '^ long', '^ btn ghost', '^ avatar avatar avatar line'],
    source: `setup
  const founders = ['AK', 'MB', 'JL', 'SR'];

section(data-section='hero' className='px-4 py-24 text-center sm:py-32')
  div(className='mx-auto flex max-w-3xl flex-col items-center gap-6')
    a(role='link' aria-disabled='true' className='inline-flex items-center gap-2 rounded-full border border-current/15 py-1 pr-3 pl-1 text-xs text-current/70 hover:bg-current/5')
      span(className='rounded-full bg-current/10 px-2 py-0.5 font-medium text-current') New
      span Nova 2.0 is here — see what changed
      span(aria-hidden='true') →
    h1(className='text-4xl font-semibold tracking-tight text-balance sm:text-6xl') Launch your idea in days, not months
    p(className='max-w-xl text-lg text-pretty text-current/70') Nova gives small teams everything they need to build, ship, and grow a modern product — without the busywork.
    div(className='flex flex-wrap items-center justify-center gap-3')
      a(role='link' aria-disabled='true' className='rounded-lg border border-current/20 bg-current/10 px-5 py-2.5 font-medium hover:bg-current/15') Start for free
      a(role='link' aria-disabled='true' className='rounded-lg px-5 py-2.5 text-current/70 hover:bg-current/5 hover:text-current') Book a demo →
    div(className='flex items-center gap-3 text-sm text-current/60')
      div(className='flex gap-1')
        each initials in founders key initials
          span(className='grid size-7 place-items-center rounded-full border border-current/20 bg-current/10 text-[10px] font-medium') #{initials}
      span Loved by 4,000+ founders
`
  },
  {
    id: 'hero-split',
    kind: 'hero',
    title: 'Split with product shot',
    description: 'Headline and benefits beside a stylized app window, ready to swap for a real screenshot.',
    wireframe: ['text media', 'btn ghost gap'],
    source: `setup
  const points = ['No credit card', 'Setup in 5 minutes', 'Cancel anytime'];
  const metrics = [{ label: 'Revenue', value: '$48.2k' }, { label: 'Customers', value: '1,284' }, { label: 'Churn', value: '1.9%' }];
  const bars = [38, 52, 44, 68, 58, 76, 64, 88, 72, 94];

section(data-section='hero' className='px-4 py-20 sm:py-28')
  div(className='mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2')
    div(className='flex flex-col items-start gap-6')
      span(className='text-sm font-medium tracking-wide text-current/60 uppercase') Workflow automation
      h1(className='text-4xl font-semibold tracking-tight text-balance sm:text-5xl') Your busywork, handled automatically
      p(className='max-w-lg text-lg text-current/70') Connect the tools you already use and let Nova route, remind, and report while your team focuses on work that matters.
      div(className='flex flex-wrap gap-3')
        a(role='link' aria-disabled='true' className='rounded-lg border border-current/20 bg-current/10 px-5 py-2.5 font-medium hover:bg-current/15') Get started
        a(role='link' aria-disabled='true' className='rounded-lg border border-current/15 px-5 py-2.5 hover:bg-current/5') Watch the tour
      ul(className='flex flex-wrap gap-x-5 gap-y-2 text-sm text-current/60')
        each point in points key point
          li(className='flex items-center gap-1.5')
            span(aria-hidden='true') ✓
            span #{point}
    div(className='rounded-2xl border border-current/15 bg-current/5 p-2 shadow-2xl')
      div(className='overflow-hidden rounded-xl border border-current/10')
        div(className='flex items-center gap-1.5 border-b border-current/10 px-3 py-2.5')
          each dot in [1, 2, 3] key dot
            span(className='size-2.5 rounded-full bg-current/20')
          span(className='ml-3 h-4 w-40 rounded bg-current/10')
        div(className='grid gap-4 p-4 sm:grid-cols-[110px_1fr]')
          div(className='hidden content-start gap-2.5 sm:grid')
            each row in [70, 90, 60, 80, 50] key row
              span(className='h-2.5 rounded bg-current/10' style={{ width: row + '%' }})
          div(className='grid gap-3')
            div(className='grid grid-cols-3 gap-3')
              each metric in metrics key metric.label
                div(className='rounded-lg border border-current/10 p-3')
                  p(className='text-[10px] text-current/50') #{metric.label}
                  p(className='text-base font-semibold sm:text-lg') #{metric.value}
            div(className='flex h-36 items-end gap-1.5 rounded-lg border border-current/10 p-3')
              each bar, index in bars key index
                span(className='flex-1 rounded-sm bg-current/20' style={{ height: bar + '%' }})
`
  },
  {
    id: 'hero-waitlist',
    kind: 'hero',
    title: 'Waitlist signup',
    description: 'A focused pre-launch hero with an email form that confirms signups right on the page.',
    wireframe: ['^ pill', '^ head', '^ long', '^ field btn'],
    source: `import { useState } from 'octane'

setup
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

section(data-section='hero' className='px-4 py-24 sm:py-36')
  div(className='mx-auto flex max-w-2xl flex-col items-center gap-6 text-center')
    span(className='rounded-full border border-current/15 px-3 py-1 text-xs tracking-widest text-current/60 uppercase') Private beta
    h1(className='text-4xl font-semibold tracking-tight text-balance sm:text-6xl') The calm way to run your company
    p(className='text-lg text-pretty text-current/70') Plans, docs, and decisions in one quiet place. Join the waitlist and be first in line when invites open.
    if joined
      p(role='status' className='rounded-lg border border-current/15 bg-current/5 px-4 py-3 text-sm') You're on the list! We'll email #{email} when your invite is ready.
    else
      form(className='flex w-full max-w-md flex-col gap-2 sm:flex-row')
        label(for='hero-email' className='sr-only') Email address
        input#hero-email(type='email' required placeholder='you@company.com' value={email} onInput={event => setEmail(event.currentTarget.value)} className='min-w-0 flex-1 rounded-lg border border-current/15 bg-current/5 px-4 py-2.5 outline-none placeholder:text-current/40 focus:border-current/40')
        button(type='submit' onClick={event => { event.preventDefault(); if (event.currentTarget.form?.reportValidity()) setJoined(true); }} className='rounded-lg border border-current/20 bg-current/10 px-5 py-2.5 font-medium hover:bg-current/15') Join the waitlist
    p(className='text-xs text-current/50') 2,300 people have already joined. No spam, ever.
`
  },
  {
    id: 'hero-statement',
    kind: 'hero',
    title: 'Editorial statement',
    description: 'Oversized type with a divider, supporting copy, actions, and a wide visual band below.',
    wireframe: ['huge', 'long gap btn ghost', 'media'],
    source: `section(data-section='hero' className='px-4 pt-20 pb-12 sm:pt-28')
  div(className='mx-auto grid max-w-6xl gap-10')
    h1(className='max-w-5xl text-5xl leading-[0.95] font-semibold tracking-tighter text-balance sm:text-7xl lg:text-8xl') Design, build, and grow — all in one place.
    div(className='flex flex-col justify-between gap-6 border-t border-current/15 pt-6 sm:flex-row sm:items-end')
      p(className='max-w-md text-lg text-current/70') From the first sketch to the thousandth customer, Nova keeps your whole product in one flow.
      div(className='flex shrink-0 gap-3')
        a(role='link' aria-disabled='true' className='rounded-lg border border-current/20 bg-current/10 px-5 py-2.5 font-medium hover:bg-current/15') Start building
        a(role='link' aria-disabled='true' className='rounded-lg border border-current/15 px-5 py-2.5 hover:bg-current/5') See pricing
    div(className='relative aspect-[21/9] overflow-hidden rounded-3xl border border-current/10 bg-linear-to-br from-current/15 via-current/5 to-transparent')
      div(className='absolute inset-0 bg-[radial-gradient(circle,currentColor_1px,transparent_1.5px)] bg-size-[22px_22px] opacity-15')
      span(className='absolute bottom-5 left-5 rounded-full border border-current/15 px-3 py-1 text-xs text-current/60 backdrop-blur') Replace with your product video
`
  }
]
