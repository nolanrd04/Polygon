import { useEffect, useRef, useState } from 'react'
import { EventBus } from '../game/core/EventBus'
import { FRAGMENT_COLORS, FRAGMENT_TIERS, type FragmentCounts } from '../game/systems/FragmentBudget'
import FragmentIcon, { FragmentRow } from './FragmentIcon'

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

// Unscaled heights of the two top blocks, from the Tailwind below. Kept beside
// the markup they describe so they cannot rot separately from it.
/** `p-4` on the container — where both blocks start. */
const TOP_PAD = 16
/** HEALTH `text-sm` 20 + `gap-1` 4 + bar `h-4` + border 18 + `gap-1` 4 + `text-xs` 16. */
const HEALTH_HEIGHT = 62
/** WAVE `text-2xl` 32 + `gap-1` 4 + fragment row `h-7` 28 + `gap-1` 4 + `text-sm` 20. */
const WAVE_HEIGHT = 88

/**
 * Bottom edge of this HUD in CSS pixels — the taller of the health block (left)
 * and the wave/fragments block (right).
 *
 * Exported because the mobile ability pads have to stay clear of it: they hang
 * off the joysticks and grow upward, so on a short screen they would otherwise
 * climb into this. See `abilityPadPosition()` in game/core/TouchLayout.ts.
 */
export function hudBlockBottom(): number {
  const scale = isMobile ? 0.5 : 1
  return TOP_PAD + Math.max(HEALTH_HEIGHT, WAVE_HEIGHT) * scale
}

interface GameHUDProps {
  health: number
  maxHealth: number
  fragments: FragmentCounts
  kills: number
  wave: number
}

const BONUS_POPUP_MS = 2200

/** The wave bonus, one "+122" per tier like the kill popups. Above the wave-complete overlay (z-50). */
function BonusPopup({ counts, onDone }: { counts: FragmentCounts; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const tiers = FRAGMENT_TIERS.filter(tier => counts[tier] > 0)

  useEffect(() => {
    const animation = ref.current?.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)', offset: 0.15 },
        { opacity: 1, transform: 'translateY(0)', offset: 0.7 },
        { opacity: 0, transform: 'translateY(-16px)' },
      ],
      { duration: BONUS_POPUP_MS }
    )
    if (animation) animation.onfinish = onDone
    return () => animation?.cancel()
  }, [])

  if (tiers.length === 0) return null
  return (
    <div
      ref={ref}
      className={`absolute right-4 z-[60] flex items-center gap-3 font-bold tabular-nums ${isMobile ? 'text-xs' : 'text-lg'}`}
      style={{ top: hudBlockBottom() + 4 }}
    >
      {tiers.map(tier => (
        <div key={tier} className="flex items-center gap-1" style={{ color: FRAGMENT_COLORS[tier] }}>
          <FragmentIcon tier={tier} size={isMobile ? 12 : 18} />
          +{counts[tier].toLocaleString()}
        </div>
      ))}
    </div>
  )
}

export default function GameHUD({ health, maxHealth, fragments, kills, wave }: GameHUDProps) {
  const healthPercent = (health / maxHealth) * 100
  const isiInfiniteMode = wave > 30
  const [bonus, setBonus] = useState<{ id: number; counts: FragmentCounts } | null>(null)

  useEffect(() => {
    const onWaveComplete = (data: { wave: number; bonus: FragmentCounts }) => {
      setBonus({ id: data.wave, counts: data.bonus })
    }
    EventBus.on('wave-complete', onWaveComplete)
    return () => EventBus.off('wave-complete', onWaveComplete)
  }, [])

  return (
    <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
      {bonus && <BonusPopup key={bonus.id} counts={bonus.counts} onDone={() => setBonus(null)} />}
      <div className="flex justify-between items-start">
        {/* Health Bar */}
        <div className="flex flex-col gap-1" style={isMobile ? { transform: 'scale(0.5)', transformOrigin: 'top left' } : undefined}>
          <div className="text-sm text-gray-400">HEALTH</div>
          <div className="w-48 h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-400"
              style={{ width: `${healthPercent}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">{Math.round(health)} / {Math.round(maxHealth)}</div>
        </div>

        {/* Wave & Fragments */}
        <div className="flex flex-col items-end gap-1" style={isMobile ? { transform: 'scale(0.5)', transformOrigin: 'top right' } : undefined}>
          <div className="text-polygon-primary text-2xl font-bold">
            {isiInfiniteMode ? `INFINITE MODE: WAVE ${wave}` : `WAVE ${wave}`}
          </div>
          <FragmentRow counts={fragments} size={16} className="h-7 text-base" />
          <div className="text-gray-400 text-sm">
            {kills.toLocaleString()} KILLS
          </div>
        </div>
      </div>
    </div>
  )
}
