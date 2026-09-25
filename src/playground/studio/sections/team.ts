import type { SectionTemplate } from '../types'

export const teamTemplates: SectionTemplate[] = [
  {
    id: 'team-grid',
    kind: 'team',
    title: 'Team grid',
    description: 'Friendly portraits with names, roles, and a one-liner, plus a hiring nudge.',
    wireframe: ['^ title', '^ avatar gap avatar gap avatar gap avatar', '^ line gap line gap line gap line'],
    source: `setup
  const people = [
    { name: 'Ada Morgan', role: 'Co-founder & CEO', bio: 'Previously led product at two YC startups.' },
    { name: 'Kenji Sato', role: 'Co-founder & CTO', bio: 'Built payments infrastructure used by millions.' },
    { name: 'Zoe Laurent', role: 'Head of Design', bio: 'Believes every pixel should earn its place.' },
    { name: 'Omar Haddad', role: 'Customer Success', bio: 'Has never met a support ticket he could not close.' }
  ];
  const initials = (name: string) => name.split(' ').map(part => part[0]).join('');

section(data-section='team' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    div(className='mx-auto mb-14 max-w-2xl text-center')
      h2(className='text-3xl font-semibold tracking-tight sm:text-4xl') Meet the team
      p(className='mt-4 text-lg text-current/70') A small, senior crew obsessed with helping founders ship.
    ul(className='grid gap-8 sm:grid-cols-2 lg:grid-cols-4')
      each person in people key person.name
        li(className='flex flex-col items-center gap-3 text-center')
          span(className='grid size-24 place-items-center rounded-full border border-current/15 bg-linear-to-br from-current/20 to-current/5 text-2xl font-semibold') #{initials(person.name)}
          div
            h3(className='font-semibold') #{person.name}
            p(className='text-sm text-current/60') #{person.role}
          p(className='max-w-56 text-sm text-current/70') #{person.bio}
    p(className='mt-14 text-center text-sm text-current/70')
      span We're hiring.
      a(role='link' aria-disabled='true' className='ml-1 font-medium underline underline-offset-4') See open roles →
`
  },
  {
    id: 'team-founders',
    kind: 'team',
    title: 'Founder letter',
    description: 'A personal note from the founders about why the company exists — builds trust fast.',
    wireframe: ['^ line', '^ head', '^ long', '^ long', '^ avatar avatar line'],
    source: `section(data-section='team' className='px-4 py-24')
  article(className='mx-auto flex max-w-2xl flex-col gap-6')
    p(className='text-sm font-medium tracking-wide text-current/60 uppercase') A note from the founders
    h2(className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl') We built Nova because we were tired of duct-taping our company together.
    div(className='grid gap-4 text-lg leading-relaxed text-current/75')
      p Our last startup ran on eleven different tools. Every Monday started with copying numbers between spreadsheets, and every launch meant a week of chasing context.
      p Nova is the product we wished we had: one calm place where plans, customers, and decisions live together. We use it every day, and we answer every email ourselves.
    div(className='mt-4 flex items-center gap-4 border-t border-current/10 pt-6')
      div(className='flex gap-1')
        span(className='grid size-11 place-items-center rounded-full border border-current/20 bg-current/10 text-sm font-medium') AM
        span(className='grid size-11 place-items-center rounded-full border border-current/20 bg-current/10 text-sm font-medium') KS
      div
        p(className='font-serif text-xl italic') Ada & Kenji
        p(className='text-sm text-current/60') Co-founders, Nova
`
  }
]
