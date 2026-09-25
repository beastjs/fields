import type { SectionTemplate } from '../types'

export const guidesTemplates: SectionTemplate[] = [
  {
    id: 'guides-steps',
    kind: 'guides',
    title: 'How it works',
    description: 'Three numbered steps joined by a line that walk visitors from sign-up to success.',
    wireframe: ['^ title', 'avatar wide avatar wide avatar', 'line gap line gap line'],
    source: `setup
  const steps = [
    { title: 'Create your workspace', text: 'Sign up with your work email and invite your team in one click.' },
    { title: 'Connect your tools', text: 'Bring in data from the apps you already use — no code required.' },
    { title: 'Launch and learn', text: 'Go live, watch results roll in, and improve with every release.' }
  ];

section(data-section='guides' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    div(className='mx-auto mb-14 max-w-2xl text-center')
      p(className='text-sm font-medium tracking-wide text-current/60 uppercase') How it works
      h2(className='mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl') Up and running in three steps
    ol(className='grid gap-10 md:grid-cols-3')
      each step, index in steps key step.title
        li(className='relative flex flex-col items-center gap-3 text-center')
          if index < steps.length - 1
            span(aria-hidden='true' className='absolute top-6 right-[calc(-50%-0.5rem)] left-[calc(50%+2rem)] hidden h-px bg-current/15 md:block')
          span(className='grid size-12 place-items-center rounded-full border border-current/20 bg-current/10 font-mono text-sm font-semibold') #{String(index + 1).padStart(2, '0')}
          h3(className='mt-2 text-lg font-semibold') #{step.title}
          p(className='max-w-xs text-sm text-current/60') #{step.text}
`
  },
  {
    id: 'guides-library',
    kind: 'guides',
    title: 'Guide library',
    description: 'Cards for tutorials and playbooks with a topic, read time, and a link — perfect for docs and resources.',
    wireframe: ['title gap line', 'card card card'],
    source: `setup
  const guides = [
    { topic: 'Getting started', title: 'Set up your first project', time: '5 min read' },
    { topic: 'Growth', title: 'Write a launch post that converts', time: '8 min read' },
    { topic: 'Playbook', title: 'Run your first customer interviews', time: '12 min read' },
    { topic: 'Integrations', title: 'Sync payments with your CRM', time: '6 min read' },
    { topic: 'Teams', title: 'Roles and permissions explained', time: '4 min read' },
    { topic: 'Security', title: 'Prepare for your first audit', time: '10 min read' }
  ];

section(data-section='guides' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    div(className='mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end')
      div
        h2(className='text-3xl font-semibold tracking-tight') Guides & playbooks
        p(className='mt-2 text-current/70') Practical advice from teams who have done it before.
      a(role='link' aria-disabled='true' className='text-sm font-medium text-current/70 hover:text-current') Browse all guides →
    div(className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3')
      each guide in guides key guide.title
        a(role='link' aria-disabled='true' className='group flex flex-col gap-6 rounded-2xl border border-current/10 p-6 transition hover:border-current/25 hover:bg-current/5')
          div(className='flex items-center justify-between text-xs text-current/60')
            span(className='rounded-full border border-current/15 px-2.5 py-0.5') #{guide.topic}
            span #{guide.time}
          h3(className='text-lg font-semibold text-balance') #{guide.title}
          span(className='mt-auto text-sm text-current/60 group-hover:text-current') Read guide →
`
  },
  {
    id: 'guides-walkthrough',
    kind: 'guides',
    title: 'Interactive walkthrough',
    description: 'A clickable list of steps that reveals details and a checklist for the chosen step.',
    wireframe: ['row gap tall', 'row gap tall', 'row gap tall'],
    source: `import { useState } from 'octane'

setup
  const steps = [
    { title: 'Import your customers', text: 'Upload a CSV or connect your payment provider. Nova de-duplicates and enriches every record.', checklist: ['CSV, Stripe, or HubSpot', 'Automatic de-duplication', 'Private by default'] },
    { title: 'Design your journeys', text: 'Choose a starting template, then tailor each email and in-app message with live previews.', checklist: ['20+ proven templates', 'Branching by behavior', 'Preview as any customer'] },
    { title: 'Measure what matters', text: 'Track activation, retention, and revenue for every journey, with weekly summaries in your inbox.', checklist: ['Cohort charts', 'Revenue attribution', 'Weekly digests'] }
  ];
  const [active, setActive] = useState(0);
  const step = steps[active];

section(data-section='guides' className='px-4 py-20 sm:py-24')
  div(className='mx-auto grid max-w-6xl gap-10 lg:grid-cols-[2fr_3fr]')
    div
      h2(className='mb-8 text-3xl font-semibold tracking-tight text-balance') Your first week with Nova
      ol(className='grid gap-2')
        each item, index in steps key item.title
          li
            button(type='button' aria-pressed={index === active} onClick={() => setActive(index)} className={'flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ' + (index === active ? 'border-current/25 bg-current/10' : 'border-transparent text-current/60 hover:bg-current/5 hover:text-current')})
              span(className='grid size-8 shrink-0 place-items-center rounded-full border border-current/20 font-mono text-xs') #{index + 1}
              span(className='font-medium') #{item.title}
    div(className='flex flex-col gap-6 rounded-3xl border border-current/10 bg-current/5 p-8')
      p(className='font-mono text-xs text-current/50') STEP #{active + 1} OF #{steps.length}
      h3(className='text-2xl font-semibold') #{step.title}
      p(className='text-lg text-current/70') #{step.text}
      ul(className='grid gap-3 border-t border-current/10 pt-6 text-sm')
        each point in step.checklist key point
          li(className='flex items-center gap-3')
            span(aria-hidden='true' className='grid size-5 place-items-center rounded-full bg-current/15 text-[10px]') ✓
            span #{point}
`
  },
  {
    id: 'guides-timetable',
    kind: 'guides',
    title: 'Festival timetable',
    description: 'A giant heading with day tabs over a ruled running order that slides and lights up on hover.',
    wireframe: ['huge gap pill pill pill', 'xs head pill', 'xs head pill', 'xs head pill'],
    source: `import { useState } from 'octane'

setup
  const days = [
    { id: 'fri', label: 'Friday', sets: [{ time: '16:00', act: 'Ghost Orchard', stage: 'Meadow' }, { time: '18:30', act: 'Lake Eerie', stage: 'Tent' }, { time: '21:00', act: 'Dune Choir', stage: 'Main' }, { time: '23:15', act: 'Solenne', stage: 'Main' }] },
    { id: 'sat', label: 'Saturday', sets: [{ time: '15:00', act: 'Oda', stage: 'Meadow' }, { time: '17:45', act: 'Velvet Static', stage: 'Tent' }, { time: '20:30', act: 'Mira Lux', stage: 'Main' }, { time: '22:45', act: 'The Paper Kites of Mars', stage: 'Main' }] },
    { id: 'sun', label: 'Sunday', sets: [{ time: '14:00', act: 'Tomasz & the Tides', stage: 'Meadow' }, { time: '16:30', act: 'Nnamdi Ray', stage: 'Tent' }, { time: '19:00', act: 'Hollow Sun', stage: 'Main' }, { time: '21:30', act: 'Kofi Ansah', stage: 'Main' }] }
  ];
  const [day, setDay] = useState('fri');
  const current = days.find(item => item.id === day) ?? days[0];

section(data-section='guides' className='px-4 py-20 sm:px-8')
  div(className='mx-auto max-w-5xl')
    div(className='mb-10 flex flex-wrap items-end justify-between gap-6')
      h2(className='text-5xl font-black tracking-[-0.05em] uppercase sm:text-7xl') Running order
      div(role='tablist' aria-label='Festival day' className='flex gap-1 rounded-full border border-current/20 p-1')
        each item in days key item.id
          button(type='button' role='tab' aria-selected={item.id === day} onClick={() => setDay(item.id)} className='rounded-full px-4 py-2 text-sm font-medium text-current/60 transition-colors hover:text-current aria-selected:bg-current/15 aria-selected:text-current') #{item.label}
    ol(className='border-t-2 border-current')
      each set in current.sets key set.time
        li(className='group grid grid-cols-[4rem_1fr_auto] items-center gap-4 border-b border-current/20 py-5 transition-all hover:pl-3')
          span(className='font-mono text-sm text-current/60') #{set.time}
          span(className='text-2xl font-bold tracking-tight uppercase transition-colors group-hover:text-[var(--studio-accent)] sm:text-4xl') #{set.act}
          span(className='rounded-full border border-current/20 px-3 py-1 font-mono text-[10px] uppercase') #{set.stage}
`
  }
]
