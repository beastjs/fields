import type { SectionTemplate } from '../types'

export const topbarTemplates: SectionTemplate[] = [
  {
    id: 'topbar-default',
    kind: 'topbar',
    title: 'Default',
    description: 'The standard signed-out header: brand, a few links, and a sign-in / get-started pair that collapses into a menu on phones.',
    wireframe: ['logo title gap xs xs xs gap ghost btn'],
    source: `import { useState } from 'octane'

setup
  const links = ['Product', 'Docs', 'Changelog'];
  const [open, setOpen] = useState(false);

header(data-section='topbar' className='sticky top-0 z-20 border-b border-current/10 bg-current/5 backdrop-blur-xl')
  nav(className='mx-auto flex h-16 max-w-6xl items-center gap-7 px-4')
    a(href='#' className='flex shrink-0 items-center gap-2.5')
      span(className='grid size-8 place-items-center rounded-xl border border-current/20 bg-current/10 text-[13px] font-bold') N
      span(className='text-[15px] font-semibold tracking-tight') Nova
    div(className='hidden items-center gap-7 text-sm text-current/60 md:flex')
      each link in links key link
        a(href='#' className='transition-colors hover:text-current') #{link}
    div(className='ml-auto flex items-center gap-1.5 text-sm')
      a(href='#' className='hidden rounded-lg px-3 py-2 text-current/70 transition-colors hover:bg-current/5 hover:text-current sm:block') Sign in
      a(href='#' className='rounded-lg border border-current/20 bg-current/10 px-3.5 py-2 font-medium transition-colors hover:bg-current/15') Get started
      button(type='button' aria-expanded={open} aria-label='Toggle menu' className='rounded-lg px-2 py-1.5 text-lg transition-colors hover:bg-current/5 md:hidden' onClick={() => setOpen(!open)}) #{open ? '✕' : '☰'}
  if open
    div(className='grid gap-1 border-t border-current/10 p-3 text-sm md:hidden')
      each link in links key link
        a(href='#' className='rounded-lg px-3 py-2 transition-colors hover:bg-current/5' onClick={() => setOpen(false)}) #{link}
      a(href='#' className='rounded-lg px-3 py-2 transition-colors hover:bg-current/5 sm:hidden') Sign in
`
  },
  {
    id: 'topbar-marketing',
    kind: 'topbar',
    title: 'Marketing',
    description: 'Brand, primary links, and a sign-in / call-to-action pair. Links collapse on narrow screens.',
    wireframe: ['logo line gap xs xs xs xs gap xs btn'],
    source: `setup
  const links = ['Product', 'Pricing', 'Docs', 'Blog'];

header(data-section='topbar' className='border-b border-current/10 backdrop-blur')
  nav(className='mx-auto flex h-14 max-w-6xl items-center gap-8 px-4')
    a(href='#' className='flex items-center gap-2 font-semibold')
      span(className='grid size-7 place-items-center rounded-lg border border-current/20 bg-current/10 text-sm') N
      span Nova
    div(className='hidden items-center gap-5 text-sm text-current/60 sm:flex')
      each link in links key link
        a(href='#' className='hover:text-current') #{link}
    div(className='ml-auto flex items-center gap-2 text-sm')
      a(href='#' className='rounded-lg px-3 py-1.5 text-current/70 hover:bg-current/5 hover:text-current') Sign in
      a(href='#' className='rounded-lg border border-current/20 bg-current/10 px-3 py-1.5 font-medium hover:bg-current/15') Get started
`
  },
  {
    id: 'topbar-app-search',
    kind: 'topbar',
    title: 'App with search',
    description: 'A product shell: brand, a wide search field with a shortcut hint, notifications, and an account avatar.',
    wireframe: ['logo line field gap dot avatar'],
    source: `header(data-section='topbar' className='border-b border-current/10')
  div(className='flex h-14 items-center gap-4 px-4')
    a(href='#' className='flex shrink-0 items-center gap-2 font-semibold')
      span(className='grid size-7 place-items-center rounded-md border border-current/20 bg-current/10 text-sm') N
      span(className='hidden sm:inline') Nova
    label(className='flex max-w-md flex-1 items-center gap-2 rounded-lg border border-current/15 bg-current/5 px-3 py-1.5 text-sm text-current/60 focus-within:border-current/40')
      span(aria-hidden='true') ⌕
      input(type='search' placeholder='Search projects…' className='min-w-0 flex-1 bg-transparent text-current outline-none placeholder:text-current/50')
      kbd(className='hidden rounded border border-current/20 px-1.5 text-xs sm:inline') ⌘K
    div(className='ml-auto flex items-center gap-3')
      button(type='button' aria-label='Notifications' className='relative grid size-8 place-items-center rounded-full text-current/60 hover:bg-current/5 hover:text-current')
        span(aria-hidden='true') ◔
        span(className='absolute top-1.5 right-1.5 size-2 rounded-full bg-current')
      button(type='button' aria-label='Account' className='grid size-8 place-items-center rounded-full border border-current/20 bg-current/10 text-xs font-semibold') JD
`
  },
  {
    id: 'topbar-centered',
    kind: 'topbar',
    title: 'Centered brand',
    description: 'A balanced editorial bar: navigation on the left, the brand centered, and actions on the right.',
    wireframe: ['xs xs xs gap title gap xs pill'],
    source: `setup
  const links = ['Shop', 'Journal', 'About'];

header(data-section='topbar')
  nav(className='mx-auto grid h-16 max-w-6xl grid-cols-3 items-center px-4 text-sm')
    div(className='flex items-center gap-5')
      each link in links key link
        a(href='#' className='hidden hover:underline sm:inline') #{link}
      button(type='button' aria-label='Open menu' className='sm:hidden') ☰
    a(href='#' className='justify-self-center font-serif text-xl tracking-[0.3em] uppercase') Nova
    div(className='flex items-center justify-end gap-4')
      a(href='#' className='hidden sm:inline') Account
      a(href='#' className='rounded-full border border-current px-3 py-1') Bag (2)
`
  },
  {
    id: 'topbar-responsive-menu',
    kind: 'topbar',
    title: 'Responsive menu',
    description: 'Inline links on wide screens and a toggleable menu on narrow ones, with local open state.',
    wireframe: ['logo line gap xs xs xs xs', 'gap wide'],
    source: `import { useState } from 'octane'

setup
  const [open, setOpen] = useState(false);
  const links = ['Features', 'Customers', 'Changelog', 'Contact'];

header(data-section='topbar' className='border-b border-current/10')
  nav(className='mx-auto flex h-14 max-w-6xl items-center justify-between px-4')
    a(href='#' className='font-semibold tracking-tight') ▲ Nova
    div(className='hidden items-center gap-6 text-sm text-current/60 md:flex')
      each link in links key link
        a(href='#' className='hover:text-current') #{link}
    button(type='button' aria-expanded={open} aria-label='Toggle menu' className='rounded-md px-2 py-1 text-lg hover:bg-current/5 md:hidden' onClick={() => setOpen(!open)}) #{open ? '✕' : '☰'}
  if open
    div(className='grid gap-1 border-t border-current/10 p-3 text-sm md:hidden')
      each link in links key link
        a(href='#' className='rounded-md px-3 py-2 hover:bg-current/5' onClick={() => setOpen(false)}) #{link}
`
  },
  {
    id: 'topbar-dashboard',
    kind: 'topbar',
    title: 'Dashboard breadcrumbs',
    description: 'A compact workspace header with a breadcrumb trail, an environment badge, and a primary action.',
    wireframe: ['logo xs xs line pill gap btn'],
    source: `setup
  const trail = ['Workspace', 'Projects', 'Website'];

header(data-section='topbar' className='flex h-12 items-center gap-3 border-b border-current/10 px-4 text-sm')
  span(className='grid size-6 place-items-center rounded border border-current/20 bg-current/10 text-xs font-bold') N
  ol(className='flex min-w-0 items-center gap-2 text-current/60')
    each crumb, index in trail key crumb
      li(className='flex items-center gap-2 truncate')
        if index > 0
          span(aria-hidden='true' className='text-current/30') /
        span(className={index === trail.length - 1 ? 'font-medium text-current' : ''}) #{crumb}
  span(className='ml-2 hidden items-center gap-1.5 rounded-full border border-current/15 px-2 py-0.5 text-xs text-current/70 sm:inline-flex')
    span(aria-hidden='true' className='size-1.5 rounded-full bg-current')
    span Production
  button(type='button' className='ml-auto rounded-md border border-current/20 bg-current/10 px-3 py-1 font-medium hover:bg-current/15') Deploy
`
  }
]
