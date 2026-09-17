import type { SectionTemplate } from '../types'

export const newsletterTemplates: SectionTemplate[] = [
  {
    id: 'newsletter-inline',
    kind: 'newsletter',
    title: 'Inline signup',
    description: 'A one-line pitch beside an email form that thanks subscribers in place.',
    wireframe: ['title gap field btn', 'long gap'],
    source: `import { useState } from 'octane'

setup
  const [subscribed, setSubscribed] = useState(false);

section(data-section='newsletter' className='px-4 py-16')
  div(className='mx-auto flex max-w-6xl flex-col justify-between gap-6 rounded-2xl border border-current/10 p-8 lg:flex-row lg:items-center')
    div
      h2(className='text-xl font-semibold') Get the founder's playbook
      p(className='mt-1 text-current/70') One practical email every two weeks. Growth, product, and fundraising lessons.
    if subscribed
      p(role='status' className='rounded-lg border border-current/15 bg-current/5 px-4 py-2.5 text-sm') Thanks! Check your inbox to confirm. ✉
    else
      form(className='flex w-full flex-col gap-2 sm:flex-row lg:w-auto')
        label(for='newsletter-email' className='sr-only') Email address
        input#newsletter-email(type='email' required placeholder='you@company.com' className='min-w-0 rounded-lg border border-current/15 bg-current/5 px-4 py-2.5 outline-none placeholder:text-current/40 focus:border-current/40 sm:w-72')
        button(type='submit' onClick={event => { event.preventDefault(); if (event.currentTarget.form?.reportValidity()) setSubscribed(true); }} className='rounded-lg border border-current/20 bg-current/10 px-5 py-2.5 font-medium whitespace-nowrap hover:bg-current/15') Subscribe
`
  },
  {
    id: 'newsletter-card',
    kind: 'newsletter',
    title: 'Updates card',
    description: 'A centered card that lists what subscribers get, with a form and a privacy reassurance.',
    wireframe: ['^ dot', '^ title', '^ line line line', '^ field btn'],
    source: `import { useState } from 'octane'

setup
  const perks = ['Product updates', 'Early access', 'Founder stories'];
  const [subscribed, setSubscribed] = useState(false);

section(data-section='newsletter' className='px-4 py-20')
  div(className='mx-auto flex max-w-xl flex-col items-center gap-5 rounded-3xl border border-current/15 bg-current/5 px-6 py-12 text-center sm:px-12')
    span(aria-hidden='true' className='grid size-12 place-items-center rounded-2xl border border-current/20 text-xl') ✉
    h2(className='text-2xl font-semibold tracking-tight sm:text-3xl') Stay in the loop
    ul(className='flex flex-wrap justify-center gap-2 text-sm')
      each perk in perks key perk
        li(className='rounded-full border border-current/15 px-3 py-1 text-current/70') #{perk}
    if subscribed
      p(role='status' className='text-sm') You're subscribed. See you in your inbox soon!
    else
      form(className='flex w-full flex-col gap-2 sm:flex-row')
        label(for='updates-email' className='sr-only') Email address
        input#updates-email(type='email' required placeholder='Enter your email' className='min-w-0 flex-1 rounded-lg border border-current/15 px-4 py-2.5 outline-none placeholder:text-current/40 focus:border-current/40')
        button(type='submit' onClick={event => { event.preventDefault(); if (event.currentTarget.form?.reportValidity()) setSubscribed(true); }} className='rounded-lg border border-current/25 bg-current/15 px-5 py-2.5 font-medium hover:bg-current/20') Notify me
    p(className='text-xs text-current/50') We respect your inbox. Unsubscribe with one click.
`
  }
]
