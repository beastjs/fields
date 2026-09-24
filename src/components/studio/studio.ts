import type { IconName } from '@/lib/icons'

export type Device = 'desktop' | 'tablet' | 'mobile'
export type StudioView = 'preview' | 'code'
export type CodeFile = 'section' | 'page'

// Each device renders at its real CSS width and scales down to fit, so breakpoints match what visitors see.
export const devices: { id: Device; label: string; icon: IconName; width: number }[] = [
  { id: 'desktop', label: 'Desktop', icon: 'desktop', width: 1280 },
  { id: 'tablet', label: 'Tablet', icon: 'tablet', width: 768 },
  { id: 'mobile', label: 'Mobile', icon: 'smartphone', width: 390 }
]
export const fileLabel = (path: string) => path.replace('/src/', '')
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
