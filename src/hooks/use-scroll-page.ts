import { useCallback, useEffect, useRef, useState } from 'octane'

interface UseScrollPercentageOptions {
  /** Throttle updates to animation frames only. Default: true */
  useRAF?: boolean
}

function calculatePageScrollPercentage(): number {
  const scrollTop: number = window.scrollY
  const docHeight: number = document.documentElement.scrollHeight
  const winHeight: number = window.innerHeight
  const scrollableHeight: number = docHeight - winHeight

  if (scrollableHeight <= 0) {
    return 100
  }

  const percentage: number = (scrollTop / scrollableHeight) * 100
  return Math.min(100, Math.max(0, percentage))
}

export function useScrollPage(options: UseScrollPercentageOptions = {}): number {
  const { useRAF = true } = options
  const [percentage, setPercentage] = useState<number>(0)
  const tickingRef = useRef<boolean>(false)

  const handleScroll = useCallback((): void => {
    if (!useRAF) {
      setPercentage(calculatePageScrollPercentage())
      return
    }

    if (!tickingRef.current) {
      window.requestAnimationFrame((): void => {
        setPercentage(calculatePageScrollPercentage())
        tickingRef.current = false
      })
      tickingRef.current = true
    }
  }, [useRAF])

  useEffect(() => {
    // Set initial value on mount
    setPercentage(calculatePageScrollPercentage())

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    return (): void => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [handleScroll])

  return percentage
}
