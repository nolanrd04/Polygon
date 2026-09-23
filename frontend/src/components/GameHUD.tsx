const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

// Unscaled heights of the two top blocks, from the Tailwind below. Kept beside
// the markup they describe so they cannot rot separately from it.
/** `p-4` on the container — where both blocks start. */
const TOP_PAD = 16
/** HEALTH `text-sm` 20 + `gap-1` 4 + bar `h-4` + border 18 + `gap-1` 4 + `text-xs` 16. */
const HEALTH_HEIGHT = 62
/** WAVE `text-2xl` 32 + `gap-1` 4 + `text-lg` 28 + `gap-1` 4 + `text-sm` 20. */
const WAVE_HEIGHT = 88

/**
 * Bottom edge of this HUD in CSS pixels — the taller of the health block (left)
 * and the wave/points block (right).
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
  points: number
  kills: number
  wave: number
}

export default function GameHUD({ health, maxHealth, points, kills, wave }: GameHUDProps) {
  const healthPercent = (health / maxHealth) * 100
  const isiInfiniteMode = wave > 30
  return (
    <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
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

        {/* Wave & Points */}
        <div className="flex flex-col items-end gap-1" style={isMobile ? { transform: 'scale(0.5)', transformOrigin: 'top right' } : undefined}>
          <div className="text-polygon-primary text-2xl font-bold">
            {isiInfiniteMode ? `INFINITE MODE: WAVE ${wave}` : `WAVE ${wave}`}
          </div>
          <div className="text-polygon-warning text-lg">
            {points.toLocaleString()} PTS
          </div>
          <div className="text-gray-400 text-sm">
            {kills.toLocaleString()} KILLS
          </div>
        </div>
      </div>
    </div>
  )
}
