import { useEffect, useState } from 'octane'
import type { api } from '../../convex/_generated/api'
import { convexClient } from '@/lib/convex-client'
import { createCaptureSettingsLoader, type CaptureSettings } from '@/lib/snaps/capture-settings'
import { DEFAULT_IMAGE_CAPTURE_SETTINGS } from '@/lib/snaps/snap-settings'

const settingsQuery = 'snapSettings/q:get' as unknown as typeof api.snapSettings.q.get
const loadSettings = createCaptureSettingsLoader(async () =>
  convexClient ? await convexClient.query(settingsQuery, {}) : { ...DEFAULT_IMAGE_CAPTURE_SETTINGS, updatedAt: null }
)

export function useCaptureSettings(enabled: boolean) {
  const [settings, setSettings] = useState<CaptureSettings>({ ...DEFAULT_IMAGE_CAPTURE_SETTINGS, updatedAt: null })
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void loadSettings().then(next => { if (!cancelled) setSettings(next) }).catch(() => {
      // Keep usable defaults. Retry on a later capture open after cache expiry.
    })
    return () => { cancelled = true }
  }, [enabled])
  return settings
}
