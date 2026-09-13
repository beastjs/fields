import { ConvexError } from 'convex/values'

export function trimOrNull(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function requireTrimmed(value: string, label: string, maxLength: number) {
  const trimmed = value.trim()
  if (!trimmed) throw new ConvexError({ code: 'INVALID_ARGUMENT', message: `${label} is required.` })
  if (trimmed.length > maxLength) {
    throw new ConvexError({ code: 'INVALID_ARGUMENT', message: `${label} must be at most ${maxLength} characters.` })
  }
  return trimmed
}

export function optionalTrimmed(value: string | undefined, label: string, maxLength: number) {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw new ConvexError({ code: 'INVALID_ARGUMENT', message: `${label} must be at most ${maxLength} characters.` })
  }
  return trimmed || undefined
}
