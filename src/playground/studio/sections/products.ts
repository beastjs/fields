import type { SectionTemplate } from '../types'

export const productsTemplates: SectionTemplate[] = [
  {
    id: 'products-grid',
    kind: 'products',
    title: 'Product cards',
    description: 'A shoppable grid with image placeholders, badges, prices, and add-to-bag buttons that respond.',
    wireframe: ['title gap line', 'tall tall tall tall', 'line gap line gap line gap line'],
    source: `import { useState } from 'octane'

setup
  const products = [
    { name: 'Everyday Tote', detail: 'Recycled canvas', price: 48, badge: 'Bestseller' },
    { name: 'Desk Lamp', detail: 'Warm dimmable LED', price: 129, badge: '' },
    { name: 'Travel Mug', detail: 'Keeps coffee hot for 6h', price: 32, badge: 'New' },
    { name: 'Notebook Set', detail: '3 dotted journals', price: 24, badge: '' }
  ];
  const [bag, setBag] = useState<string[]>([]);
  const toggle = (name: string) => setBag(items => items.includes(name) ? items.filter(item => item !== name) : [...items, name]);

section(data-section='products' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    div(className='mb-10 flex items-end justify-between gap-4')
      div
        h2(className='text-3xl font-semibold tracking-tight') New this season
        p(className='mt-2 text-current/70') Thoughtfully made goods for work and weekends.
      p(role='status' className='rounded-full border border-current/15 px-3 py-1 text-sm whitespace-nowrap') Bag · #{bag.length}
    div(className='grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4')
      each product in products key product.name
        article(className='group flex flex-col gap-3')
          div(className='relative aspect-[4/5] overflow-hidden rounded-2xl border border-current/10 bg-linear-to-b from-current/10 to-current/5')
            if product.badge
              span(className='absolute top-3 left-3 rounded-full border border-current/15 px-2.5 py-0.5 text-xs backdrop-blur') #{product.badge}
            span(aria-hidden='true' className='absolute inset-0 grid place-items-center text-5xl text-current/20 transition group-hover:scale-110') ◇
          div(className='flex items-start justify-between gap-2')
            div
              h3(className='font-medium') #{product.name}
              p(className='text-sm text-current/60') #{product.detail}
            p(className='font-medium') $#{product.price}
          button(type='button' onClick={() => toggle(product.name)} aria-pressed={bag.includes(product.name)} className='rounded-lg border border-current/15 px-3 py-2 text-sm font-medium hover:bg-current/5 aria-pressed:bg-current/10') #{bag.includes(product.name) ? 'Added ✓' : 'Add to bag'}
`
  },
  {
    id: 'products-suite',
    kind: 'products',
    title: 'Product suite',
    description: 'Three product pillars side by side with key capabilities, the middle one highlighted.',
    wireframe: ['^ title', 'card feature card'],
    source: `setup
  const products = [
    { mark: '◎', name: 'Nova Insights', tagline: 'Understand every customer', points: ['Funnels & cohorts', 'Session replays', 'Custom dashboards'], featured: false },
    { mark: '✦', name: 'Nova Studio', tagline: 'Build pages without code', points: ['40+ section templates', 'Live collaboration', 'One-click publishing'], featured: true },
    { mark: '⇄', name: 'Nova Connect', tagline: 'Sync all your tools', points: ['200+ integrations', 'Two-way sync', 'Webhooks & API'], featured: false }
  ];

section(data-section='products' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    div(className='mx-auto mb-14 max-w-2xl text-center')
      p(className='text-sm font-medium tracking-wide text-current/60 uppercase') The platform
      h2(className='mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl') Three products. One seamless flow.
    div(className='grid items-stretch gap-4 lg:grid-cols-3')
      each product in products key product.name
        article(className={'flex flex-col gap-6 rounded-3xl border p-8 ' + (product.featured ? 'border-current/30 bg-current/10' : 'border-current/10')})
          span(aria-hidden='true' className='grid size-12 place-items-center rounded-2xl border border-current/20 text-xl') #{product.mark}
          div
            h3(className='text-xl font-semibold') #{product.name}
            p(className='mt-1 text-current/60') #{product.tagline}
          ul(className='grid gap-2 text-sm')
            each point in product.points key point
              li(className='flex items-center gap-2')
                span(aria-hidden='true' className='text-current/50') —
                span #{point}
          a(role='link' aria-disabled='true' className='mt-auto text-sm font-medium hover:underline') Explore #{product.name} →
`
  },
  {
    id: 'products-tabs',
    kind: 'products',
    title: 'Product tabs',
    description: 'Tabs that switch between products, each with a pitch, highlights, and a showcase panel.',
    wireframe: ['^ pill pill pill', 'text media'],
    source: `import { useState } from 'octane'

setup
  const products = [
    { name: 'Web', headline: 'A website that builds itself', text: 'Pick sections, add your words, and publish a fast, accessible site in an afternoon.', highlights: ['Responsive by default', 'SEO-ready pages', 'Custom domains'] },
    { name: 'Mobile', headline: 'Your app, in every pocket', text: 'Ship native-feeling iOS and Android experiences from the same product data.', highlights: ['Offline mode', 'Push notifications', 'App store ready'] },
    { name: 'Commerce', headline: 'Sell anything, anywhere', text: 'Launch a storefront with checkout, subscriptions, and inventory that stays in sync.', highlights: ['Global payments', 'Subscriptions', 'Tax handled'] }
  ];
  const [active, setActive] = useState(0);
  const product = products[active];

section(data-section='products' className='px-4 py-20 sm:py-24')
  div(className='mx-auto max-w-6xl')
    div(role='tablist' aria-label='Products' className='mx-auto mb-12 flex w-fit gap-1 rounded-full border border-current/15 p-1')
      each item, index in products key item.name
        button(type='button' role='tab' aria-selected={index === active} onClick={() => setActive(index)} className={'rounded-full px-5 py-2 text-sm font-medium transition ' + (index === active ? 'bg-current/15' : 'text-current/60 hover:text-current')}) #{item.name}
    div(role='tabpanel' className='grid items-center gap-10 lg:grid-cols-2')
      div(className='flex flex-col gap-5')
        h2(className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl') #{product.headline}
        p(className='text-lg text-current/70') #{product.text}
        ul(className='flex flex-wrap gap-2')
          each highlight in product.highlights key highlight
            li(className='rounded-full border border-current/15 px-3 py-1 text-sm') #{highlight}
        a(role='link' aria-disabled='true' className='w-fit rounded-lg border border-current/20 bg-current/10 px-5 py-2.5 font-medium hover:bg-current/15') Try Nova #{product.name}
      div(className='relative aspect-[4/3] overflow-hidden rounded-3xl border border-current/10 bg-linear-to-tr from-current/15 to-transparent')
        span(className='absolute inset-0 grid place-items-center text-6xl font-semibold tracking-tighter text-current/15') #{product.name}
`
  },
  {
    id: 'products-specimen',
    kind: 'products',
    title: 'Type specimens',
    description: 'Tall specimen cards with a giant sample glyph per family that grows and takes the accent on hover.',
    wireframe: ['head gap line', 'tall tall tall tall'],
    source: `setup
  const families = [
    { name: 'Ondine', note: 'Didone · 9 weights', sample: 'Aa', style: 'font-serif font-light italic' },
    { name: 'Brutus', note: 'Grotesk · 12 weights', sample: 'Rg', style: 'font-sans font-black tracking-tighter' },
    { name: 'Circuit', note: 'Mono · 6 weights', sample: '{ }', style: 'font-mono' },
    { name: 'Halcyon', note: 'Old style · 8 weights', sample: 'Qé', style: 'font-serif font-bold' }
  ];

section(data-section='products' className='px-4 py-20 sm:px-8')
  div(className='mx-auto max-w-7xl')
    div(className='mb-10 flex flex-wrap items-end justify-between gap-4')
      h2(className='text-5xl font-black tracking-[-0.04em] sm:text-6xl') The library
      p(className='text-sm text-current/60') Hover a specimen to set it in motion.
    div(className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4')
      each family in families key family.name
        article(className='group flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-2xl border border-current/15 p-5 transition-colors hover:border-current/40 hover:bg-current/5')
          div(className='flex justify-between font-mono text-[10px] text-current/60 uppercase')
            span #{family.name}
            span #{family.note}
          p(aria-hidden='true' className={'text-[8rem] leading-none whitespace-nowrap transition-all duration-500 group-hover:scale-110 group-hover:text-[var(--studio-accent)] ' + family.style}) #{family.sample}
          div(className='flex flex-col gap-3')
            p(className={'truncate text-sm text-current/70 ' + family.style}) The quick brown fox jumps over the lazy dog
            a(role='link' aria-disabled='true' className='text-sm font-medium hover:underline') Try #{family.name} →
`
  },
  {
    id: 'products-salon',
    kind: 'products',
    title: 'Salon hang',
    description: 'Framed abstract works of different proportions hung in a staggered masonry wall, each with a caption.',
    wireframe: ['head gap line', 'tall card tall', 'card tall card'],
    source: `setup
  const works = [
    { title: 'Low Tide Hymn', artist: 'I. Okoro-Vale', year: 2026, price: '€4,800', aspect: 'aspect-[4/5]', art: 'bg-[radial-gradient(circle_at_30%_30%,var(--studio-accent),transparent_60%)]' },
    { title: 'Grid for a Storm', artist: 'T. Wren', year: 2025, price: '€3,200', aspect: 'aspect-square', art: 'bg-[repeating-linear-gradient(90deg,currentColor_0_2px,transparent_2px_18px)] opacity-40' },
    { title: 'Salt Study III', artist: 'A. Brandt', year: 2026, price: '€2,650', aspect: 'aspect-[3/4]', art: 'bg-[conic-gradient(from_200deg_at_60%_40%,var(--studio-accent),transparent_30%,currentColor_60%,transparent)] opacity-60' },
    { title: 'Weather Report', artist: 'R. Solís', year: 2024, price: '€5,100', aspect: 'aspect-[5/4]', art: 'bg-[linear-gradient(transparent_46%,currentColor_46%_48%,transparent_48%),radial-gradient(circle_at_70%_30%,currentColor_0_12%,transparent_13%)] opacity-60' },
    { title: 'Two Moons', artist: 'J. Oyelaran', year: 2026, price: '€1,900', aspect: 'aspect-[4/5]', art: 'bg-[radial-gradient(circle_at_35%_50%,currentColor_0_18%,transparent_19%),radial-gradient(circle_at_65%_50%,var(--studio-accent)_0_18%,transparent_19%)]' },
    { title: 'Undertow', artist: 'I. Okoro-Vale', year: 2025, price: '€6,400', aspect: 'aspect-[3/2]', art: 'bg-[repeating-radial-gradient(circle_at_50%_120%,currentColor_0_1px,transparent_1px_14px)] opacity-50' }
  ];

section(data-section='products' className='px-4 py-20 sm:px-8')
  div(className='mx-auto max-w-7xl')
    div(className='mb-12 flex flex-wrap items-baseline justify-between gap-4 border-b border-current/20 pb-4')
      h2(className='font-serif text-5xl italic') In the room
      p(className='text-[11px] tracking-[0.3em] text-current/60 uppercase') #{works.length} works · available by enquiry
    div(className='columns-1 gap-8 sm:columns-2 lg:columns-3')
      each work in works key work.title
        figure(className='group mb-10 break-inside-avoid')
          div(className='border-[10px] border-current/10 p-4 shadow-xl transition-transform duration-500 group-hover:-translate-y-1 group-hover:shadow-2xl')
            div(aria-hidden='true' className={'relative overflow-hidden bg-current/5 ' + work.aspect})
              div(className={'absolute inset-0 transition-transform duration-[1.5s] group-hover:scale-110 ' + work.art})
          figcaption(className='mt-4 grid grid-cols-[1fr_auto] gap-x-4 text-sm')
            span(className='font-serif italic') #{work.title}
            span(className='text-current/60') #{work.price}
            span(className='text-xs text-current/50') #{work.artist + ', ' + work.year}
`
  }
]
