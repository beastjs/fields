import { useCallback, useState } from 'octane'

interface UseToggleReturn {
  on: boolean
  toggle: VoidFunction
  setOn: (value: boolean) => void
}
export const useToggle = (initialState?: boolean): UseToggleReturn => {
  const [on, setOn] = useState<boolean>(() => initialState ?? false)

  const toggle = useCallback((): void => {
    setOn((prevState: boolean): boolean => !prevState)
  }, [])

  return { on, toggle, setOn }
}
