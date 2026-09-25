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
  },
  {
    id: 'hero-manifesto',
    kind: 'hero',
    title: 'Brutalist manifesto',
    description: 'Poster-scale stacked type with an outlined word, beside a ruled list of numbered theses.',
    wireframe: ['huge row', 'huge row', 'huge row', 'huge btn'],
    source: `setup
  const theses = ['Form follows feeling.', 'Ornament is information.', 'The grid is a suggestion.', 'Ship the weird version.'];

section(data-section='hero' className='border-b-2 border-current')
  div(className='grid lg:grid-cols-[1fr_24rem]')
    div(className='px-4 py-10 sm:px-8 lg:border-r-2 lg:border-current')
      p(className='mb-6 font-mono text-xs tracking-widest uppercase') ▲ A manifesto in four parts
      h1(className='text-[clamp(3.5rem,13vw,11rem)] leading-[0.82] font-black tracking-[-0.07em] uppercase')
        span(className='block') Make
        span(className='block pl-[0.6em] [-webkit-text-fill-color:transparent] [-webkit-text-stroke:2px_currentColor]') things
        span(className='block') that
        span(className='block text-[var(--studio-accent)]') shout.
    ol(className='flex flex-col border-t-2 border-current font-mono text-sm lg:border-t-0')
      each thesis, index in theses key thesis
        li(className='flex gap-4 border-b-2 border-current px-4 py-5 transition-all hover:bg-current/10 hover:pl-7')
          span(className='text-current/50') #{'0' + (index + 1)}
          span(className='font-sans text-lg leading-tight font-bold tracking-tight') #{thesis}
      li(className='mt-auto')
        a(role='link' aria-disabled='true' className='group flex items-center justify-between px-4 py-6 font-sans text-lg font-black tracking-tight uppercase transition-colors hover:bg-current/10')
          span Sign the manifesto
          span(aria-hidden='true' className='text-3xl transition-transform group-hover:rotate-45') ↗
`
  },
  {
    id: 'hero-kinetic',
    kind: 'hero',
    title: 'Kinetic type',
    description: 'Three rows of giant words drifting in opposite directions, one of them outlined, over a quiet pitch.',
    wireframe: ['huge huge huge', 'gap huge huge', 'huge huge huge', 'text gap btn'],
    source: `setup
  const rows = [
    { words: ['Specimen', 'Glyph', 'Kerning', 'Ligature'], motion: 'animate-[studio-marquee_28s_linear_infinite]', outline: false },
    { words: ['Italic', 'Swash', 'Counter', 'Serif'], motion: 'animate-[studio-marquee_34s_linear_infinite_reverse]', outline: true },
    { words: ['Display', 'Ink trap', 'Terminal', 'Spur'], motion: 'animate-[studio-marquee_24s_linear_infinite]', outline: false }
  ];

section(data-section='hero' className='overflow-hidden py-16 sm:py-24')
  div(aria-hidden='true' className='grid gap-1 select-none')
    each row, rowIndex in rows key rowIndex
      div(className={'flex w-max motion-reduce:animate-none ' + row.motion})
        each word, index in [...row.words, ...row.words] key index
          span(className={'px-5 text-[clamp(4rem,14vw,12rem)] leading-[0.95] font-black tracking-[-0.05em] whitespace-nowrap ' + (row.outline ? '[-webkit-text-fill-color:transparent] italic [-webkit-text-stroke:1.5px_currentColor]' : index % 2 ? 'text-current/20' : '')}) #{word}
  div(className='mx-auto mt-14 flex max-w-5xl flex-col items-start gap-8 px-4 sm:flex-row sm:items-end sm:justify-between')
    div(className='max-w-md')
      p(className='font-mono text-xs tracking-widest text-[var(--studio-accent)] uppercase') Foundry Ø — 14 families, 212 styles
      h1(className='mt-3 text-2xl leading-snug font-medium text-balance sm:text-3xl') Typefaces with a pulse, drawn for screens that never sit still.
    a(role='link' aria-disabled='true' className='group inline-flex shrink-0 items-center gap-3 rounded-full border border-current px-6 py-3 text-sm font-medium transition-all hover:gap-5 hover:bg-current/10')
      span Browse the library
      span(aria-hidden='true') →
`
  },
  {
    id: 'hero-exhibition',
    kind: 'hero',
    title: 'Gallery exhibition',
    description: 'A framed, slowly shifting abstract canvas beside an italic serif artist name and exhibition dates.',
    wireframe: ['tall text', 'line gap'],
    source: `section(data-section='hero' className='px-4 py-16 sm:px-8 sm:py-24')
  div(className='mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[auto_1fr_1fr]')
    p(className='hidden font-mono text-[11px] tracking-[0.4em] text-current/50 uppercase [writing-mode:vertical-rl] lg:block') Exhibition — 12.09 → 30.11
    figure(className='group')
      div(className='aspect-[4/5] border-[14px] border-current/10 p-5 shadow-2xl outline outline-1 outline-current/20')
        div(aria-hidden='true' className='relative size-full overflow-hidden bg-current/5')
          div(className='absolute -top-1/4 -left-1/4 size-[90%] rounded-full bg-[var(--studio-accent)] opacity-70 blur-2xl transition-transform duration-[2s] group-hover:translate-x-10 group-hover:translate-y-6')
          div(className='absolute -right-[10%] -bottom-[15%] size-[75%] rounded-full bg-current/30 blur-xl transition-transform duration-[2s] group-hover:-translate-x-6 group-hover:-translate-y-8')
          div(className='absolute inset-x-[18%] top-[30%] h-px bg-current')
          div(className='absolute top-[12%] bottom-[12%] left-[62%] w-[3px] bg-current')
          div(className='absolute right-[14%] bottom-[18%] size-16 rotate-12 border-2 border-current transition-transform duration-[2s] group-hover:rotate-45')
      figcaption(className='mt-4 flex justify-between gap-4 text-xs text-current/60')
        span(className='italic') Untitled (Tidal), 2026
        span Oil and noise on linen
    div(className='flex flex-col gap-6')
      p(className='text-[11px] tracking-[0.4em] text-current/50 uppercase') Room 3 · Solo show
      h1(className='font-serif text-6xl leading-[0.9] tracking-tight sm:text-8xl')
        span(className='block') Ines
        span(className='block italic') Okoro-Vale
      p(className='max-w-sm text-lg leading-relaxed text-current/70') Forty paintings about the colour of water just before it decides to become weather.
      div(className='flex flex-wrap items-center gap-6 text-sm')
        a(role='link' aria-disabled='true' className='border-b border-current pb-0.5 hover:italic') Plan your visit
        a(role='link' aria-disabled='true' className='text-current/60 hover:text-current') Read the essay →
`
  },
  {
    id: 'hero-swiss',
    kind: 'hero',
    title: 'Swiss poster',
    description: 'International Typographic Style: a visible column grid, a colossal numeral, a ring, and tight grotesk type.',
    wireframe: ['xs gap xs gap xs', 'huge text', 'huge btn'],
    source: `setup
  const columns = Array.from({ length: 12 }, (_, index) => index);
  const credits = ['Kunsthalle', 'Zürich', '1957 — 2026'];

section(data-section='hero' className='relative overflow-hidden px-4 py-10 sm:px-8')
  div(aria-hidden='true' className='pointer-events-none absolute inset-0 grid grid-cols-6 px-4 sm:grid-cols-12 sm:px-8')
    each column in columns key column
      span(className={'border-l border-current/10 ' + (column === 11 ? 'border-r ' : '') + (column >= 6 ? 'hidden sm:block' : '')})
  div(className='relative grid grid-cols-6 gap-x-4 sm:grid-cols-12')
    div(className='col-span-6 flex justify-between font-mono text-[11px] tracking-wider text-current/60 uppercase sm:col-span-12')
      each credit in credits key credit
        span #{credit}
    p(aria-hidden='true' className='col-span-6 mt-6 text-[clamp(10rem,36vw,30rem)] leading-[0.78] font-bold tracking-[-0.08em] text-[var(--studio-accent)] sm:col-span-7') 57
    div(className='col-span-6 mt-8 flex flex-col justify-end gap-6 pb-4 sm:col-span-5')
      div(aria-hidden='true' className='size-24 rounded-full border-[18px] border-current transition-transform duration-700 hover:scale-110 sm:size-36')
      h1(className='text-4xl leading-[0.95] font-bold tracking-tight sm:text-6xl') Neue Grafik. Objective, clear, alive.
      p(className='max-w-sm text-sm leading-relaxed text-current/70') A retrospective of the poster as a machine for thinking — grids, grotesks, and the radical beauty of saying one thing well.
      a(role='link' aria-disabled='true' className='self-start border-t-4 border-current pt-2 text-sm font-bold tracking-wider uppercase transition-colors hover:text-[var(--studio-accent)]') Tickets →
`
  },
  {
    id: 'hero-orbit',
    kind: 'hero',
    title: 'Orbit',
    description: 'Concentric rings with glowing satellites circling a soft core, behind a light, wide headline.',
    wireframe: ['^ line', '^ huge', '^ long', '^ btn ghost'],
    source: `setup
  const rings = [
    { size: 'min(34vw,15rem)', dot: 8, motion: 'animate-[studio-spin_16s_linear_infinite]' },
    { size: 'min(58vw,26rem)', dot: 12, motion: 'animate-[studio-spin_28s_linear_infinite_reverse]' },
    { size: 'min(84vw,38rem)', dot: 6, motion: 'animate-[studio-spin_46s_linear_infinite]' },
    { size: 'min(112vw,52rem)', dot: 14, motion: 'animate-[studio-spin_70s_linear_infinite_reverse]' }
  ];

section(data-section='hero' className='relative grid min-h-[88vh] place-items-center overflow-hidden px-4 py-24')
  div(aria-hidden='true' className='pointer-events-none absolute inset-0 grid place-items-center')
    div(className='absolute size-64 rounded-full bg-[var(--studio-accent)] opacity-30 blur-3xl')
    each ring, index in rings key index
      div(className={'absolute aspect-square rounded-full border border-current/30 motion-reduce:animate-none ' + ring.motion + (index % 2 ? ' border-dashed' : '')} style={{ width: ring.size }})
        span(className='absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--studio-accent)] shadow-[0_0_24px_var(--studio-accent)]' style={{ width: ring.dot + 'px', height: ring.dot + 'px' }})
  div(className='relative flex max-w-2xl flex-col items-center gap-6 text-center')
    p(className='font-mono text-[11px] tracking-[0.4em] text-current/60 uppercase') Observatory · live sky
    h1(className='text-5xl leading-[0.95] font-light tracking-tight text-balance sm:text-7xl')
      span(className='block') Everything orbits
      span(className='block font-serif italic') a good idea.
    p(className='max-w-md text-lg text-current/70') A studio for immersive installations, planetarium shows, and stories told in light.
    div(className='flex flex-wrap justify-center gap-3')
      a(role='link' aria-disabled='true' className='rounded-full border border-current/30 bg-current/10 px-6 py-3 font-medium backdrop-blur transition-colors hover:bg-current/20') Enter the dome
      a(role='link' aria-disabled='true' className='rounded-full px-6 py-3 text-current/70 transition-colors hover:text-current') See past skies →
`
  },
  {
    id: 'hero-cover',
    kind: 'hero',
    title: 'Magazine cover',
    description: 'A cover plate with a glowing halftone and giant italic cover line, beside a drop-cap standfirst and contents.',
    wireframe: ['tall text', 'tall row', 'tall btn'],
    source: `setup
  const contents = [
    { kicker: 'Feature', title: 'The architects of quiet', page: 12 },
    { kicker: 'Essay', title: 'Why every city needs a useless tower', page: 30 },
    { kicker: 'Portfolio', title: '24 pages of night swimming', page: 48 }
  ];

section(data-section='hero' className='px-4 py-10 sm:px-8')
  div(className='mx-auto grid max-w-7xl gap-8 lg:grid-cols-12')
    div(className='relative aspect-[3/4] overflow-hidden bg-current/5 lg:col-span-7')
      div(aria-hidden='true' className='absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,var(--studio-accent),transparent_55%)] opacity-60')
      div(aria-hidden='true' className='absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-[size:7px_7px] opacity-15')
      div(aria-hidden='true' className='absolute -right-10 bottom-16 size-72 rounded-full border border-current/30')
      p(className='absolute top-6 left-6 font-mono text-[10px] tracking-widest uppercase') Cover story
      h1(className='absolute right-6 bottom-6 left-6 font-serif text-[clamp(3rem,8vw,7.5rem)] leading-[0.85] font-black tracking-tight italic') The Soft Revolution
    div(className='flex flex-col justify-between gap-10 lg:col-span-5')
      p(className='font-serif text-2xl leading-snug text-balance first-letter:float-left first-letter:mr-2 first-letter:text-7xl first-letter:leading-[0.8] first-letter:font-black first-letter:text-[var(--studio-accent)]') How a generation of makers traded speed for tenderness — and built the most interesting objects of the decade.
      ol(className='divide-y divide-current/15 border-y border-current/15')
        each entry in contents key entry.title
          li(className='group grid grid-cols-[3rem_1fr] gap-2 py-4')
            span(className='font-mono text-xs text-current/50') p. #{entry.page}
            span
              span(className='block text-[10px] tracking-[0.3em] text-current/50 uppercase') #{entry.kicker}
              span(className='block text-lg font-medium transition-transform group-hover:translate-x-1 group-hover:italic') #{entry.title}
      a(role='link' aria-disabled='true' className='self-start rounded-full bg-current/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/15') Read the issue →
`
  },
  {
    id: 'hero-blueprint',
    kind: 'hero',
    title: 'Blueprint',
    description: 'Drafting-paper grid, a sheet number, and a line drawing with dimension marks and an accent survey point.',
    wireframe: ['xs gap media', 'head gap media', 'long gap media', 'btn ghost gap'],
    source: `section(data-section='hero' className='relative overflow-hidden px-4 py-20 sm:px-8 sm:py-28')
  div(aria-hidden='true' className='absolute inset-0 bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.05]')
  div(aria-hidden='true' className='absolute inset-0 bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] bg-[size:160px_160px] opacity-[0.09]')
  div(className='relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2')
    div(className='flex flex-col items-start gap-6')
      p(className='font-mono text-xs text-current/60') SHEET A-101 · SCALE 1:50 · REV. 04
      h1(className='text-5xl leading-[0.95] font-semibold tracking-tight text-balance sm:text-7xl') Buildings that breathe with the land.
      p(className='max-w-md text-lg text-current/70') Atelier Norde designs low-carbon homes, libraries, and bathhouses — measured twice, drawn by hand, built to outlast us.
      div(className='flex flex-wrap gap-3')
        a(role='link' aria-disabled='true' className='border border-current bg-current/10 px-5 py-2.5 font-mono text-sm uppercase transition-colors hover:bg-current/20') View projects
        a(role='link' aria-disabled='true' className='border border-current/30 px-5 py-2.5 font-mono text-sm uppercase transition-colors hover:border-current') Our method
    figure(className='flex flex-col gap-3')
      svg(aria-hidden='true' viewBox='0 0 400 400' fill='none' stroke='currentColor' className='w-full')
        path(d='M40 300 L200 140 L360 300' strokeWidth='2')
        rect(x='80' y='300' width='240' height='70' strokeWidth='2')
        rect(x='175' y='320' width='50' height='50' strokeOpacity='0.6')
        circle(cx='200' cy='228' r='28' strokeOpacity='0.6')
        path(d='M200 200 V256 M172 228 H228' strokeOpacity='0.4')
        path(d='M20 370 H380' strokeDasharray='4 6' strokeOpacity='0.5')
        path(d='M80 390 H320 M80 384 V396 M320 384 V396' strokeOpacity='0.6')
        path(d='M385 140 V370 M379 140 H391 M379 370 H391' strokeOpacity='0.6')
        path(d='M200 140 V40' strokeDasharray='2 4' stroke='var(--studio-accent)')
        circle(cx='200' cy='40' r='6' fill='var(--studio-accent)' stroke='none')
      figcaption(className='flex justify-between font-mono text-[10px] text-current/60')
        span Section B–B · 12 400 mm
        span N ↑
`
  },
  {
    id: 'hero-lineup',
    kind: 'hero',
    title: 'Festival lineup',
    description: 'A festival poster: a slowly turning sunburst, a giant outlined name, and acts billed in three sizes.',
    wireframe: ['^ line', '^ huge', '^ head head', '^ title title title', '^ line line line line', '^ btn'],
    source: `setup
  const tiers = [
    ['Solenne', 'The Paper Kites of Mars'],
    ['Kofi Ansah', 'Dune Choir', 'Mira Lux', 'Hollow Sun'],
    ['Oda', 'Velvet Static', 'Nnamdi Ray', 'Lake Eerie', 'Tomasz & the Tides', 'Ghost Orchard']
  ];
  const sizes = ['text-[clamp(2.25rem,7vw,5.5rem)] font-black tracking-[-0.05em]', 'text-[clamp(1.5rem,4vw,3rem)] font-bold tracking-tight', 'text-[clamp(1rem,2.2vw,1.5rem)] font-medium'];

section(data-section='hero' className='relative overflow-hidden px-4 py-16 text-center sm:py-24')
  div(aria-hidden='true' className='pointer-events-none absolute top-1/2 left-1/2 size-[150vmax] -translate-1/2')
    div(className='size-full animate-[studio-spin_120s_linear_infinite] bg-[repeating-conic-gradient(currentColor_0deg_3deg,transparent_3deg_15deg)] opacity-[0.05] motion-reduce:animate-none')
  div(className='relative mx-auto flex max-w-5xl flex-col items-center gap-8')
    p(className='font-mono text-xs tracking-[0.4em] uppercase') Aug 14 — 16 · Salt Marsh · Three days, one field
    h1(className='text-[clamp(4rem,16vw,14rem)] leading-[0.8] font-black tracking-[-0.07em] uppercase')
      span(className='block') Tide
      span(className='block [-webkit-text-fill-color:transparent] [-webkit-text-stroke:2px_var(--studio-accent)]') water
    div(className='flex flex-col gap-3')
      each tier, tierIndex in tiers key tierIndex
        p(className={'flex flex-wrap items-center justify-center gap-x-4 gap-y-1 uppercase ' + sizes[tierIndex]})
          each act, index in tier key act
            span(className='inline-flex items-center gap-4')
              span(className='transition-colors hover:text-[var(--studio-accent)]') #{act}
              if index < tier.length - 1
                span(aria-hidden='true' className='text-[0.5em] text-current/40') ✦
    a(role='link' aria-disabled='true' className='mt-4 rounded-full bg-[var(--studio-accent)]/25 ring-2 ring-[var(--studio-accent)] px-8 py-4 text-lg font-black tracking-tight uppercase transition-transform hover:scale-105 hover:-rotate-2') Get weekend passes
`
  },
  {
    id: 'hero-collage',
    kind: 'hero',
    title: 'Zine collage',
    description: 'Cut-and-paste energy: tilted word blocks, taped notes, a starburst, and a sticker scattered around the headline.',
    wireframe: ['card gap gap pill', '^ huge', '^ head head', 'gap gap gap card', '^ btn'],
    source: `setup
  const words = [
    { text: 'Glue', style: '-rotate-3 bg-current/10' },
    { text: 'your', style: 'rotate-2 border-4 border-current' },
    { text: 'ideas', style: 'rotate-1 font-serif italic lowercase text-[var(--studio-accent)]' },
    { text: 'to', style: '-rotate-2 bg-current/20' },
    { text: 'the', style: 'rotate-3 border-b-8 border-current' },
    { text: 'wall', style: '-rotate-1 [-webkit-text-fill-color:transparent] [-webkit-text-stroke:2px_currentColor]' }
  ];

section(data-section='hero' className='relative overflow-hidden px-4 py-24 sm:py-32')
  div(aria-hidden='true' className='absolute top-[8%] left-[4%] hidden w-44 -rotate-6 border border-current/20 bg-current/5 p-4 text-left font-mono text-xs shadow-xl md:block')
    span(className='absolute -top-3 left-1/2 h-6 w-16 -translate-x-1/2 rotate-3 bg-current/15')
    span issue 09 — photocopied with love at 2am
  div(aria-hidden='true' className='absolute top-[10%] right-[6%] grid size-28 rotate-12 place-items-center rounded-full bg-[var(--studio-accent)]/25 ring-2 ring-[var(--studio-accent)] text-center text-xs leading-tight font-black uppercase shadow-lg') Free · every · month
  div(aria-hidden='true' className='absolute bottom-[10%] left-[10%] size-24 -rotate-12 animate-[studio-spin_30s_linear_infinite] bg-current/70 [clip-path:polygon(50%_0,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)] motion-reduce:animate-none')
  div(aria-hidden='true' className='absolute right-[8%] bottom-[14%] hidden rotate-3 border-2 border-dashed border-current px-4 py-2 font-mono text-xs sm:block') ✂ cut here
  div(className='relative mx-auto flex max-w-4xl flex-col items-center gap-10 text-center')
    h1(className='flex flex-wrap justify-center gap-x-3 gap-y-3 text-[clamp(3rem,10vw,8rem)] leading-none font-black uppercase')
      each word in words key word.text
        span(className={'inline-block px-3 transition-transform duration-300 hover:scale-110 hover:rotate-0 ' + word.style}) #{word.text}
    p(className='max-w-lg text-lg text-current/70') Scrapbook is a monthly zine and open studio for people who make things with scissors, scanners, and questionable glue sticks.
    a(role='link' aria-disabled='true' className='-rotate-2 border-2 border-current bg-current/10 px-6 py-3 font-mono text-sm uppercase shadow-[6px_6px_0_currentColor] transition-all hover:rotate-0 hover:shadow-[2px_2px_0_currentColor]') Grab this issue
`
  },
  {
    id: 'hero-dotfield',
    kind: 'hero',
    title: 'Generative field',
    description: 'A computed field of dots shaped by sine waves, shimmering behind a headline about art that draws itself.',
    wireframe: ['dot dot dot dot dot dot dot dot', '^ head', '^ long', 'dot dot dot dot dot dot dot dot', '^ btn ghost'],
    source: `setup
  const columns = 32;
  const dots = Array.from({ length: columns * 14 }, (_, index) => {
    const x = index % columns;
    const y = Math.floor(index / columns);
    const wave = Math.sin(x / 3.2) * Math.cos(y / 2.4) + Math.sin((x + y) / 5);
    return { index, scale: (wave + 2) / 4, delay: (x + y) * 90 };
  });

section(data-section='hero' className='relative overflow-hidden px-4 py-24 sm:py-32')
  div(aria-hidden='true' className='pointer-events-none absolute inset-0 grid place-items-center opacity-70 [mask-image:radial-gradient(ellipse_at_center,transparent_18%,black_42%,transparent_78%)]')
    div(className='grid w-[max(100%,64rem)] gap-3' style={{ gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))' }})
      each dot in dots key dot.index
        span(className='mx-auto aspect-square w-full max-w-3 animate-pulse rounded-full bg-current motion-reduce:animate-none' style={{ transform: 'scale(' + dot.scale + ')', animationDelay: dot.delay + 'ms' }})
  div(className='relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center')
    p(className='rounded-full border border-current/20 bg-current/5 px-3 py-1 font-mono text-xs backdrop-blur') sin(x) · cos(y) · you
    h1(className='text-5xl leading-[0.95] font-semibold tracking-tighter text-balance sm:text-7xl') Art that computes itself.
    p(className='max-w-xl text-lg text-current/70') Field is a creative-coding studio. We write small programs that draw large feelings — installations, identities, and generative editions.
    div(className='flex flex-wrap justify-center gap-3')
      a(role='link' aria-disabled='true' className='rounded-full bg-[var(--studio-accent)]/25 ring-2 ring-[var(--studio-accent)] px-6 py-3 font-medium transition-transform hover:scale-105') Mint an edition
      a(role='link' aria-disabled='true' className='rounded-full border border-current/25 px-6 py-3 backdrop-blur transition-colors hover:bg-current/10') Read the source →
`
  },
  {
    id: 'hero-bauhaus',
    kind: 'hero',
    title: 'Bauhaus shapes',
    description: 'A nine-tile grid of circles, quarter-rounds, and triangles that turn on hover, beside a three-word creed.',
    wireframe: ['card card card head', 'card card card head', 'card card card btn'],
    source: `setup
  const tiles = [
    'rounded-full bg-[var(--studio-accent)]',
    'rounded-tl-full bg-current',
    'bg-current/15',
    'bg-current [clip-path:polygon(50%_0,100%_100%,0_100%)]',
    'rounded-br-full bg-[var(--studio-accent)]/70',
    'rounded-full border-[12px] border-current',
    'rounded-l-full bg-current/60',
    'bg-[repeating-linear-gradient(45deg,currentColor_0_2px,transparent_2px_10px)]',
    'scale-50 rounded-full bg-current/30'
  ];

section(data-section='hero' className='px-4 py-16 sm:px-8 sm:py-24')
  div(className='mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2')
    div(aria-hidden='true' className='grid aspect-square grid-cols-3 gap-2')
      each tile, index in tiles key index
        div(className={'transition-transform duration-500 hover:rotate-90 ' + tile})
    div(className='flex flex-col items-start gap-6')
      p(className='text-xs font-bold tracking-[0.3em] uppercase') Werkstatt · Est. 1919 / 2026
      h1(className='text-6xl leading-[0.85] font-black tracking-tighter uppercase sm:text-8xl')
        span(className='block') Form.
        span(className='block text-[var(--studio-accent)]') Colour.
        span(className='block') Play.
      p(className='max-w-md text-lg text-current/70') A school without walls for designers, weavers, and tinkerers. Twelve weeks of making things with your hands before you touch a screen.
      a(role='link' aria-disabled='true' className='bg-current/10 px-6 py-3 font-bold tracking-wide uppercase transition-colors hover:bg-[var(--studio-accent)]/30') Apply for spring
`
  },
  {
    id: 'hero-verse',
    kind: 'hero',
    title: 'Slow verse',
    description: 'Generous whitespace, staggered serif verses that breathe on hover, and a vertical word in the margin.',
    wireframe: ['xs gap', 'head gap line', 'gap head line', 'head gap line', 'line gap'],
    source: `setup
  const verses = ['I wanted a place', 'where the words could rest,', 'where the margin', 'was part of the poem.'];

section(data-section='hero' className='px-6 py-28 sm:py-40')
  div(className='mx-auto grid max-w-5xl gap-16 sm:grid-cols-[1fr_auto]')
    div(className='flex flex-col gap-10')
      p(className='font-mono text-[11px] tracking-[0.35em] text-current/50 uppercase') Marginalia — a quarterly of slow reading
      h1(className='font-serif text-3xl leading-[1.25] font-light sm:text-5xl lg:text-6xl')
        each verse, index in verses key index
          span(className='block transition-all duration-700 hover:tracking-wide hover:text-[var(--studio-accent)]' style={{ paddingLeft: (index % 2) * 2 + 'em' }}) #{verse}
      div(className='flex items-center gap-4')
        span(className='h-px w-16 bg-current/40')
        a(role='link' aria-disabled='true' className='font-serif text-lg italic transition-colors hover:text-[var(--studio-accent)]') Begin reading
    p(aria-hidden='true' className='hidden font-serif text-[9rem] leading-none text-current/10 [writing-mode:vertical-rl] sm:block') 余白
`
  }
]
