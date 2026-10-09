import { useEffect, useState } from 'react'

export type BattleSpeed = 'slow' | 'normal' | 'fast'

/** How much every animation duration is multiplied by. */
export const SPEED_FACTORS: Record<BattleSpeed, number> = { slow: 1.6, normal: 1, fast: 0.45 }

const STORAGE_KEY = 'banner-and-blade:speed'

function loadSpeed(): BattleSpeed {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    return stored === 'slow' || stored === 'fast' ? stored : 'normal'
  } catch {
    return 'normal'
  }
}

export function useBattleSpeed() {
  const [speed, setSpeed] = useState<BattleSpeed>(loadSpeed)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, speed)
    } catch {
      // Storage can be blocked; the setting just is not remembered then.
    }
  }, [speed])

  return [speed, setSpeed] as const
}
