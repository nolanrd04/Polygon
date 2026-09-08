import type { AbilitySlotState } from '../game/systems/AbilitySystem'

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

interface Theme {
  border: string
  chip: string
  chipText: string
  text: string
  bar: string
  pip: string
}

/**
 * Accent palettes, keyed by the `theme` on an ability's activation def. Class
 * strings are spelled out in full because Tailwind only keeps classes it can
 * see literally in the source — building them by interpolation drops them.
 */
const THEMES: Record<string, Theme> = {
  cyan: {
    border: 'border-cyan-500/50',
    chip: 'bg-cyan-500/20 border-cyan-500',
    chipText: 'text-cyan-400',
    text: 'text-cyan-400',
    bar: 'bg-gradient-to-r from-cyan-600 to-cyan-400',
    pip: 'bg-cyan-500',
  },
  blue: {
    border: 'border-blue-500/50',
    chip: 'bg-blue-500/20 border-blue-500',
    chipText: 'text-blue-400',
    text: 'text-blue-400',
    bar: 'bg-gradient-to-r from-blue-600 to-blue-400',
    pip: 'bg-blue-500',
  },
  rose: {
    border: 'border-rose-500/50',
    chip: 'bg-rose-500/20 border-rose-500',
    chipText: 'text-rose-400',
    text: 'text-rose-400',
    bar: 'bg-gradient-to-r from-rose-600 to-rose-400',
    pip: 'bg-rose-500',
  },
  green: {
    border: 'border-green-500/50',
    chip: 'bg-green-500/20 border-green-500',
    chipText: 'text-green-400',
    text: 'text-green-400',
    bar: 'bg-gradient-to-r from-green-600 to-green-400',
    pip: 'bg-green-500',
  },
}

function AbilityCard({ slot }: { slot: AbilitySlotState }) {
  // A usable ability is green, regardless of available charges. If unusable then it flips color
  const atFullCharge = slot.recharges && slot.ready > 0
  const theme = atFullCharge ? THEMES.green : THEMES[slot.theme] ?? THEMES.blue

  return (
    <div className={`bg-gray-900/80 border rounded-lg p-2 min-w-[160px] ${theme.border}`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded flex items-center justify-center border ${theme.chip}`}>
          <span className={`font-bold ${slot.keyLabel.length > 1 ? 'text-xs' : 'text-sm'} ${theme.chipText}`}>
            {slot.keyLabel}
          </span>
        </div>

        <div className="flex-1">
          <div className="text-xs text-gray-400">{slot.label}</div>

          {slot.recharges ? (
            // Recharging: one bar tracking the charge next to come back.
            <div className="relative w-full h-2 bg-gray-800 rounded-full overflow-hidden mt-0.5 border border-gray-700">
              <div
                className={`h-full transition-all duration-100 ${theme.bar}`}
                style={{ width: `${slot.progress * 100}%` }}
              />
            </div>
          ) : (
            // Consumable: one pip per charge in hand.
            <div className="flex items-center gap-1 mt-0.5">
              {Array.from({ length: slot.ready }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-sm ${theme.pip}`} />
              ))}
            </div>
          )}
        </div>

        {slot.recharges ? (
          <div className={`text-xs font-bold whitespace-nowrap min-w-[24px] text-center ${theme.text}`}>
            x{slot.ready}
          </div>
        ) : (
          <div className={`font-bold text-lg ${theme.text}`}>{slot.ready}</div>
        )}
      </div>
    </div>
  )
}

/**
 * HUD stack of the player's usable abilities. Entirely driven by the slots
 * AbilitySystem reports, so a new ability shows up here with no edit.
 */
export default function AbilityDisplay({ slots }: { slots: AbilitySlotState[] }) {
  if (slots.length === 0) return null

  return (
    <div className="absolute top-24 left-4 pointer-events-none" style={isMobile ? { transform: 'scale(0.5)', transformOrigin: 'top left' } : undefined}>
      <div className="flex flex-col gap-2">
        {slots.map(slot => (
          <AbilityCard key={slot.id} slot={slot} />
        ))}
      </div>
    </div>
  )
}
