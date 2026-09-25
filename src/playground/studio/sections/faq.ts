import type { SectionTemplate } from '../types'

export const faqTemplates: SectionTemplate[] = [
  {
    id: 'faq-accordion',
    kind: 'faq',
    title: 'Accordion',
    description: 'Expandable questions built on native disclosure elements — accessible and keyboard friendly.',
    wireframe: ['^ title', 'row', 'row', 'row', 'row'],
    source: `setup
  const faqs = [
    { question: 'Is there a free plan?', answer: 'Yes. The Starter plan is free forever for one project, with no credit card required.' },
    { question: 'Can I switch plans later?', answer: 'Anytime. Upgrades apply immediately and downgrades take effect at the end of your billing period.' },
    { question: 'Do you offer discounts for startups?', answer: 'Early-stage startups get 50% off Pro for the first year. Reach out with your company details.' },
    { question: 'Where is my data stored?', answer: 'In SOC 2 certified data centers in the EU or US — you choose the region when you create a workspace.' },
    { question: 'How do I cancel?', answer: 'From Settings → Billing, in two clicks. You can export all of your data before you go.' }
  ];

section(data-section='faq' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-3xl')
    h2(className='mb-10 text-center text-3xl font-semibold tracking-tight sm:text-4xl') Frequently asked questions
    div(className='divide-y divide-current/10 border-y border-current/10')
      each faq, index in faqs key faq.question
        details(className='group py-5' open={index === 0})
          summary(className='flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden')
            span #{faq.question}
            span(aria-hidden='true' className='grid size-7 shrink-0 place-items-center rounded-full border border-current/15 text-current/60 transition group-open:rotate-45') +
          p(className='mt-3 pr-10 leading-relaxed text-current/70') #{faq.answer}
`
  },
  {
    id: 'faq-columns',
    kind: 'faq',
    title: 'Two columns',
    description: 'A heading with a contact prompt on one side and an always-open grid of answers on the other.',
    wireframe: ['title gap line line', 'long gap line line', 'btn gap line line'],
    source: `setup
  const faqs = [
    { question: 'How long does setup take?', answer: 'Most teams are live in under ten minutes with our guided import.' },
    { question: 'Do I need a developer?', answer: 'No. Everything can be configured visually, and developers get a full API when they want it.' },
    { question: 'Can I bring my own domain?', answer: 'Yes, on every paid plan, with free SSL certificates included.' },
    { question: 'What about security?', answer: 'SSO, role-based access, audit logs, and encryption at rest and in transit.' }
  ];

section(data-section='faq' className='px-4 py-20 sm:py-24')
  div(className='mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_2fr]')
    div(className='flex flex-col items-start gap-4')
      h2(className='text-3xl font-semibold tracking-tight') Questions? Answered.
      p(className='text-current/70') Can't find what you're looking for? Our team usually replies within an hour.
      a(role='link' aria-disabled='true' className='rounded-lg border border-current/15 px-4 py-2 text-sm font-medium hover:bg-current/5') Contact support
    dl(className='grid gap-x-10 gap-y-8 sm:grid-cols-2')
      each faq in faqs key faq.question
        div
          dt(className='font-semibold') #{faq.question}
          dd(className='mt-2 leading-relaxed text-current/70') #{faq.answer}
`
  }
]
