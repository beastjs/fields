import type { SectionTemplate } from '../types'

export const featuresTemplates: SectionTemplate[] = [
  {
    id: 'features-grid',
    kind: 'features',
    title: 'Icon grid',
    description: 'A section heading over six concise benefits, each with a glyph, title, and one-line explanation.',
    wireframe: ['^ title', 'dot line gap dot line gap dot line', 'dot line gap dot line gap dot line'],
    source: `setup
  const features = [
    { icon: '⚡', title: 'Instant setup', text: 'Import your data and go live in minutes, not sprints.' },
    { icon: '◎', title: 'Built-in analytics', text: 'See what customers do and where they get stuck.' },
    { icon: '⇄', title: 'Two-way sync', text: 'Keep every tool in step without brittle scripts.' },
    { icon: '⌘', title: 'Keyboard first', text: 'Everything is a shortcut away for power users.' },
    { icon: '◇', title: 'Secure by default', text: 'SSO, audit logs, and encryption on every plan.' },
    { icon: '✦', title: 'Thoughtful AI', text: 'Drafts, summaries, and suggestions that stay out of the way.' }
  ];

section(data-section='features' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    div(className='mx-auto mb-14 max-w-2xl text-center')
      p(className='text-sm font-medium tracking-wide text-current/60 uppercase') Features
      h2(className='mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl') Everything you need, nothing you don't
      p(className='mt-4 text-lg text-current/70') A focused toolkit that grows with you from the first customer to the thousandth.
    div(className='grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3')
      each feature in features key feature.title
        div(className='flex gap-4')
          span(aria-hidden='true' className='grid size-10 shrink-0 place-items-center rounded-xl border border-current/15 bg-current/5 text-lg') #{feature.icon}
          div
            h3(className='font-semibold') #{feature.title}
            p(className='mt-1 text-sm leading-relaxed text-current/60') #{feature.text}
`
  },
  {
    id: 'features-bento',
    kind: 'features',
    title: 'Bento grid',
    description: 'Asymmetric cards with miniature visuals — a modern way to show off a product’s depth.',
    wireframe: ['^ title', 'tall card', 'card tall'],
    source: `setup
  const avatars = ['AK', 'MB', 'JL', 'SR', 'TP'];
  const chart = [30, 45, 38, 60, 52, 70, 64, 82];

section(data-section='features' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    h2(className='mb-12 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl') One workspace for the way modern teams actually work
    div(className='grid gap-4 md:grid-cols-6')
      article(className='flex flex-col justify-between gap-8 rounded-3xl border border-current/10 bg-current/5 p-6 md:col-span-4')
        div(className='flex h-40 items-end gap-2')
          each bar, index in chart key index
            span(className='flex-1 rounded-t-md bg-current/20' style={{ height: bar + '%' }})
        div
          h3(className='text-lg font-semibold') Live insights
          p(className='mt-1 text-sm text-current/60') Dashboards update the moment something changes — no refresh button required.
      article(className='flex flex-col justify-between gap-8 rounded-3xl border border-current/10 p-6 md:col-span-2')
        div(className='flex flex-wrap gap-2')
          each person in avatars key person
            span(className='grid size-10 place-items-center rounded-full border border-current/20 bg-current/10 text-xs font-medium') #{person}
        div
          h3(className='text-lg font-semibold') Multiplayer by default
          p(className='mt-1 text-sm text-current/60') Invite your team and see edits as they happen.
      article(className='flex flex-col justify-between gap-8 rounded-3xl border border-current/10 p-6 md:col-span-2')
        p(className='font-mono text-4xl font-semibold tracking-tight') 120ms
        div
          h3(className='text-lg font-semibold') Fast everywhere
          p(className='mt-1 text-sm text-current/60') Edge-rendered pages load in a blink on any connection.
      article(className='flex flex-col justify-between gap-8 rounded-3xl border border-current/10 bg-current/5 p-6 md:col-span-4')
        div(className='grid gap-2 font-mono text-xs text-current/70')
          div(className='rounded-lg border border-current/10 px-3 py-2') → New signup: ada@example.com
          div(className='rounded-lg border border-current/10 px-3 py-2') ✓ Welcome email sent
          div(className='rounded-lg border border-current/10 px-3 py-2 text-current/40') ◌ Onboarding call scheduled…
        div
          h3(className='text-lg font-semibold') Automations that explain themselves
          p(className='mt-1 text-sm text-current/60') Every step is logged in plain language, so nothing happens behind your back.
`
  },
  {
    id: 'features-alternating',
    kind: 'features',
    title: 'Alternating rows',
    description: 'Deep-dive rows that alternate text and visual sides, each with a checklist of details.',
    wireframe: ['text media', 'media text'],
    source: `setup
  const rows = [
    { eyebrow: 'Plan', title: 'Turn ideas into a roadmap in minutes', text: 'Drag goals onto a timeline, assign owners, and let Nova flag conflicts before they become problems.', points: ['Shared timelines', 'Dependencies that update themselves', 'Weekly progress digests'] },
    { eyebrow: 'Build', title: 'Ship with confidence, every single day', text: 'Previews, reviews, and releases in one place, so the whole team knows what is going out and when.', points: ['Instant preview links', 'One-click rollbacks', 'Release notes written for you'] }
  ];

section(data-section='features' className='px-4 py-20 sm:py-24')
  div(className='mx-auto grid max-w-6xl gap-20')
    each row, index in rows key row.title
      div(className='grid items-center gap-10 lg:grid-cols-2')
        div(className={'flex flex-col gap-4 ' + (index % 2 ? 'lg:order-2' : '')})
          p(className='text-sm font-medium tracking-wide text-current/60 uppercase') #{row.eyebrow}
          h2(className='text-3xl font-semibold tracking-tight text-balance') #{row.title}
          p(className='text-lg text-current/70') #{row.text}
          ul(className='mt-2 grid gap-2 text-sm')
            each point in row.points key point
              li(className='flex items-center gap-2')
                span(aria-hidden='true' className='grid size-5 place-items-center rounded-full border border-current/20 text-[10px]') ✓
                span #{point}
        div(className='relative aspect-[4/3] overflow-hidden rounded-3xl border border-current/10 bg-linear-to-br from-current/10 to-transparent')
          div(className='absolute inset-6 rounded-2xl border border-current/10 bg-current/5')
          div(className='absolute inset-x-12 top-14 grid gap-3')
            span(className='h-3 w-1/2 rounded bg-current/15')
            span(className='h-3 w-3/4 rounded bg-current/10')
            span(className='h-3 w-2/3 rounded bg-current/10')
`
  },
  {
    id: 'features-index',
    kind: 'features',
    title: 'Giant index',
    description: 'Disciplines as a ruled index of huge uppercase words that slide and turn italic on hover.',
    wireframe: ['xs gap xs', 'num huge line', 'num huge line', 'num huge line', 'num huge line'],
    source: `setup
  const services = [
    { title: 'Identity', detail: 'Marks, wordmarks, and systems that misbehave on purpose.', tags: 'Brand · Type · Motion' },
    { title: 'Spatial', detail: 'Exhibitions, signage, and rooms you remember with your body.', tags: 'Wayfinding · Sets' },
    { title: 'Digital', detail: 'Websites that feel like objects rather than documents.', tags: 'Web · Interactive' },
    { title: 'Editions', detail: 'Books, prints, and small runs of beautiful nonsense.', tags: 'Print · Risograph' }
  ];

section(data-section='features' className='border-b-2 border-current')
  div(className='flex items-end justify-between border-b-2 border-current px-4 py-4 font-mono text-xs uppercase sm:px-8')
    h2 What we do
    span (#{services.length}) disciplines
  ol
    each service, index in services key service.title
      li(className='group grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 gap-y-2 border-b-2 border-current px-4 py-6 transition-colors last:border-b-0 hover:bg-current/10 sm:grid-cols-[4rem_1fr_16rem_10rem] sm:px-8')
        span(className='font-mono text-sm text-current/50') (#{index + 1})
        h3(className='text-5xl font-black tracking-[-0.05em] uppercase transition-transform duration-300 group-hover:translate-x-3 group-hover:italic sm:text-7xl') #{service.title}
        p(className='col-start-2 text-sm text-current/70 sm:col-start-auto') #{service.detail}
        span(className='col-start-2 font-mono text-[11px] text-current/50 uppercase transition-colors group-hover:text-[var(--studio-accent)] sm:col-start-auto sm:text-right') #{service.tags}
`
  },
  {
    id: 'features-editorial',
    kind: 'features',
    title: 'Long read',
    description: 'A magazine spread: a serif headline and byline beside two ruled columns with a drop cap and pull quote.',
    wireframe: ['head text text', 'line text text', 'gap text text'],
    source: `setup
  const paragraphs = [
    'The workshop smells of cedar and cold coffee. Nobody here is in a hurry, and that is precisely the point: every object on the long table has been sanded, tested, argued over, and sanded again.',
    'Speed, the founders say, is a kind of forgetting. When you move fast you stop noticing the grain, the weight, the small resistance a good drawer gives before it opens.',
    'So they built a practice around noticing. Each piece begins as a walk, then a sketch, then a model the size of a matchbox, then — only then — the real thing.',
    'The result is furniture that feels less designed than discovered, as if it had always been waiting in the wood for someone patient enough to find it.'
  ];

section(data-section='features' className='px-4 py-20 sm:px-8')
  div(className='mx-auto grid max-w-6xl gap-10 border-t-4 border-double border-current/60 pt-8 lg:grid-cols-[1fr_2fr]')
    div(className='flex flex-col gap-4')
      p(className='font-mono text-[10px] tracking-[0.3em] text-[var(--studio-accent)] uppercase') The long read
      h2(className='font-serif text-4xl leading-tight font-black italic sm:text-5xl') On making things slowly
      p(className='text-sm text-current/60') Words by Aurelio Mance · Photographs by nobody, on purpose
    div(className='columns-1 gap-10 font-serif text-lg leading-relaxed text-current/80 sm:columns-2 [column-rule:1px_solid_color-mix(in_oklab,currentColor_15%,transparent)]')
      each paragraph, index in paragraphs key index
        div
          p(className={'mb-5 ' + (index === 0 ? 'first-letter:float-left first-letter:mr-3 first-letter:text-7xl first-letter:leading-[0.8] first-letter:font-black first-letter:text-[var(--studio-accent)]' : '')}) #{paragraph}
          if index === 1
            blockquote(className='mb-5 break-inside-avoid border-y border-current/30 py-4 text-2xl leading-snug text-current italic') “Slowness is not the absence of speed. It is the presence of attention.”
`
  },
  {
    id: 'features-shapes',
    kind: 'features',
    title: 'Geometric course',
    description: 'Three ruled panels, each led by a primary shape — circle, triangle, square — that spins on hover.',
    wireframe: ['head gap', 'feature feature feature'],
    source: `setup
  const courses = [
    { shape: 'rounded-full bg-[var(--studio-accent)]', title: 'Colour', body: 'Mix pigment before pixels. Learn why yellow is loud and blue keeps secrets.', length: '4 weeks' },
    { shape: 'bg-current [clip-path:polygon(50%_0,100%_100%,0_100%)]', title: 'Type & grid', body: 'Set metal type by hand, then break every rule you just learned — deliberately.', length: '4 weeks' },
    { shape: 'rotate-45 scale-75 border-[10px] border-current', title: 'Material', body: 'Wood, wool, clay, and steel. Each one argues back; we teach you to listen.', length: '4 weeks' }
  ];

section(data-section='features' className='px-4 py-20 sm:px-8')
  div(className='mx-auto max-w-6xl')
    h2(className='mb-12 max-w-2xl text-4xl leading-[0.95] font-black tracking-tight uppercase sm:text-6xl') The foundation course, reimagined.
    div(className='grid divide-y divide-current/20 border border-current/20 md:grid-cols-3 md:divide-x md:divide-y-0')
      each course, index in courses key course.title
        article(className='group flex flex-col gap-5 p-8 transition-colors hover:bg-current/5')
          div(aria-hidden='true' className={'size-20 transition-transform duration-700 group-hover:rotate-180 ' + course.shape})
          span(className='mt-4 font-mono text-xs text-current/50') 0#{index + 1} / #{course.length}
          h3(className='text-3xl font-black tracking-tight uppercase') #{course.title}
          p(className='text-current/70') #{course.body}
`
  },
  {
    id: 'features-stickers',
    kind: 'features',
    title: 'Taped notes',
    description: 'Four tilted paper notes with strips of tape, which straighten and lift when you hover them.',
    wireframe: ['^ head', 'card card card card'],
    source: `setup
  const notes = [
    { title: 'Photocopy everything', body: 'Grain is a feature. Toner streaks are free texture.', tilt: '-rotate-2' },
    { title: 'Steal like a magpie', body: 'Keep a drawer of scraps: tickets, receipts, wrong turns.', tilt: 'rotate-1' },
    { title: 'Staple it anyway', body: 'Finished is a feeling you get after you hand it out.', tilt: 'rotate-3' },
    { title: 'Mail it to strangers', body: 'Every issue goes to ten people we have never met.', tilt: '-rotate-1' }
  ];

section(data-section='features' className='px-4 py-20')
  div(className='mx-auto max-w-6xl')
    h2(className='mb-16 text-center font-serif text-5xl italic sm:text-6xl') Rules for the cut-and-paste club
    div(className='grid gap-10 sm:grid-cols-2 lg:grid-cols-4')
      each note, index in notes key note.title
        article(className={'relative border border-current/20 bg-current/5 p-6 pt-8 shadow-lg transition-transform duration-300 hover:-translate-y-2 hover:rotate-0 ' + note.tilt})
          span(aria-hidden='true' className='absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-3 bg-current/15 backdrop-blur-sm')
          span(className='font-mono text-xs text-[var(--studio-accent)]') rule no. #{index + 1}
          h3(className='mt-2 text-2xl leading-tight font-black uppercase') #{note.title}
          p(className='mt-3 text-sm text-current/70') #{note.body}
`
  }
]
