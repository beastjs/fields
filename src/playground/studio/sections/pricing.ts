import type { SectionTemplate } from '../types'

export const pricingTemplates: SectionTemplate[] = [
  {
    id: 'pricing-tiers',
    kind: 'pricing',
    title: 'Three tiers',
    description: 'Starter, Pro, and Scale plans with a monthly / yearly switch and a highlighted favorite.',
    wireframe: ['^ title', '^ pill', 'tall feature tall'],
    source: `import { useState } from 'octane'

setup
  const [yearly, setYearly] = useState(true);
  const plans = [
    { name: 'Starter', monthly: 0, text: 'For side projects and first launches.', perks: ['1 project', 'Basic analytics', 'Community support'], cta: 'Start free', featured: false },
    { name: 'Pro', monthly: 29, text: 'For growing teams shipping every week.', perks: ['Unlimited projects', 'Advanced analytics', 'Custom domains', 'Priority support'], cta: 'Start 14-day trial', featured: true },
    { name: 'Scale', monthly: 99, text: 'For companies with serious traffic.', perks: ['Everything in Pro', 'SSO & audit logs', 'Uptime SLA', 'Dedicated manager'], cta: 'Talk to sales', featured: false }
  ];
  const price = (monthly: number) => yearly ? Math.round(monthly * 0.8) : monthly;

section(data-section='pricing' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    div(className='mx-auto mb-10 max-w-2xl text-center')
      h2(className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl') Simple pricing that scales with you
      p(className='mt-4 text-lg text-current/70') Start free. Upgrade when you're ready. Cancel anytime.
    div(className='mb-12 flex justify-center')
      div(role='group' aria-label='Billing period' className='flex gap-1 rounded-full border border-current/15 p-1 text-sm')
        button(type='button' aria-pressed={!yearly} onClick={() => setYearly(false)} className={'rounded-full px-4 py-1.5 ' + (yearly ? 'text-current/60' : 'bg-current/15 font-medium')}) Monthly
        button(type='button' aria-pressed={yearly} onClick={() => setYearly(true)} className={'rounded-full px-4 py-1.5 ' + (yearly ? 'bg-current/15 font-medium' : 'text-current/60')}) Yearly · save 20%
    div(className='grid items-start gap-4 lg:grid-cols-3')
      each plan in plans key plan.name
        article(className={'flex flex-col gap-6 rounded-3xl border p-8 ' + (plan.featured ? 'border-current/30 bg-current/10 lg:-mt-4 lg:pb-12' : 'border-current/10')})
          div(className='flex items-center justify-between')
            h3(className='text-lg font-semibold') #{plan.name}
            if plan.featured
              span(className='rounded-full border border-current/20 px-2.5 py-0.5 text-xs') Most popular
          p(className='flex items-baseline gap-1')
            span(className='text-5xl font-semibold tracking-tight') $#{price(plan.monthly)}
            span(className='text-sm text-current/60') / month
          p(className='text-sm text-current/70') #{plan.text}
          a(href='#' className={'rounded-lg border px-4 py-2.5 text-center font-medium ' + (plan.featured ? 'border-current/25 bg-current/15 hover:bg-current/20' : 'border-current/15 hover:bg-current/5')}) #{plan.cta}
          ul(className='grid gap-3 border-t border-current/10 pt-6 text-sm')
            each perk in plan.perks key perk
              li(className='flex items-center gap-2')
                span(aria-hidden='true') ✓
                span #{perk}
`
  },
  {
    id: 'pricing-single',
    kind: 'pricing',
    title: 'Single plan',
    description: 'One honest price with everything included — clear for early-stage products and lifetime deals.',
    wireframe: ['text feature'],
    source: `setup
  const included = ['Unlimited projects', 'All integrations', 'Custom domains', 'Team collaboration', 'Analytics & reports', 'Priority email support'];

section(data-section='pricing' className='px-4 py-20 sm:py-24')
  div(className='mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-current/15 lg:grid-cols-[3fr_2fr]')
    div(className='flex flex-col gap-6 p-8 sm:p-10')
      h2(className='text-3xl font-semibold tracking-tight') One plan. Everything included.
      p(className='text-lg text-current/70') No feature gates, no seat math, no surprise invoices. Just the whole product for one fair price.
      p(className='text-sm font-medium tracking-wide text-current/60 uppercase') What's included
      ul(className='grid gap-3 text-sm sm:grid-cols-2')
        each item in included key item
          li(className='flex items-center gap-2')
            span(aria-hidden='true' className='grid size-5 place-items-center rounded-full border border-current/20 text-[10px]') ✓
            span #{item}
    div(className='flex flex-col items-center justify-center gap-4 border-t border-current/10 bg-current/5 p-10 text-center lg:border-t-0 lg:border-l')
      p(className='font-medium text-current/70') Pay once, own it forever
      p(className='flex items-baseline gap-1')
        span(className='text-6xl font-semibold tracking-tight') $249
        span(className='text-current/60') USD
      a(href='#' className='w-full rounded-lg border border-current/25 bg-current/15 px-5 py-3 font-medium hover:bg-current/20') Get lifetime access
      p(className='text-xs text-current/50') 30-day money-back guarantee
`
  },
  {
    id: 'pricing-compare',
    kind: 'pricing',
    title: 'Comparison table',
    description: 'A feature-by-plan table that makes the differences obvious for careful buyers.',
    wireframe: ['wide num num num', 'row', 'row', 'row'],
    source: `setup
  const plans = [{ name: 'Starter', price: '$0' }, { name: 'Pro', price: '$29' }, { name: 'Scale', price: '$99' }];
  const rows = [
    { feature: 'Projects', values: ['1', 'Unlimited', 'Unlimited'] },
    { feature: 'Team members', values: ['2', '10', 'Unlimited'] },
    { feature: 'Custom domains', values: ['—', '✓', '✓'] },
    { feature: 'Advanced analytics', values: ['—', '✓', '✓'] },
    { feature: 'SSO & audit logs', values: ['—', '—', '✓'] },
    { feature: 'Support', values: ['Community', 'Priority', 'Dedicated'] }
  ];

section(data-section='pricing' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-5xl')
    h2(className='mb-10 text-center text-3xl font-semibold tracking-tight sm:text-4xl') Compare plans
    div(className='overflow-x-auto rounded-2xl border border-current/10')
      table(className='w-full min-w-[560px] border-collapse text-left text-sm')
        thead
          tr(className='border-b border-current/10')
            th(scope='col' className='p-4 font-medium text-current/60') Features
            each plan in plans key plan.name
              th(scope='col' className='p-4')
                span(className='block text-base font-semibold') #{plan.name}
                span(className='block font-normal text-current/60') #{plan.price} / month
        tbody
          each row in rows key row.feature
            tr(className='border-b border-current/10 last:border-b-0 hover:bg-current/5')
              th(scope='row' className='p-4 font-normal') #{row.feature}
              each value, index in row.values key index
                td(className={'p-4 ' + (value === '—' ? 'text-current/30' : '')}) #{value}
`
  }
]
