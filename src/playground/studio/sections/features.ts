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
  }
]
