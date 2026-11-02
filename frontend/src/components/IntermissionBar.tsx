import { useEffect } from 'react'
import { GameManager } from '../game/core/GameManager'
import { WaveAction, formatKeyLabel, getBoundKeys, matchesKey } from '../game/core/Keybinds'

interface IntermissionBarProps {
  wave: number
  shopOpen: boolean
  onToggleShop: () => void
  onStartWave: () => void
}

/**
 * Desktop between-wave controls: open the shop or start the next wave. Mounted
 * for the whole intermission, so its keybinds (Tab / Enter by default) work
 * with the shop open too. Mobile uses the Play button beside pause (TouchControlManager) and
 * the pause menu's Shop button instead.
 *
 * Buttons never take focus (mousedown is cancelled): a focused button would be
 * clicked by Space, which is the dash key.
 */
export default function IntermissionBar({ wave, shopOpen, onToggleShop, onStartWave }: IntermissionBarProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (GameManager.getState().isPaused) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (matchesKey(event, WaveAction.StartWave)) {
        event.preventDefault()
        onStartWave()
      } else if (matchesKey(event, WaveAction.ToggleShop)) {
        event.preventDefault()
        if (!event.repeat) onToggleShop()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onStartWave, onToggleShop])

  if (shopOpen) return null

  return (
    <div className="absolute left-0 right-0 flex flex-col items-center pointer-events-none" style={{ bottom: 76 }}>
      <div className="text-gray-300 font-bold tracking-wider text-sm mb-2">
        WAVE {wave} READY
      </div>
      <div className="flex gap-4 pointer-events-auto">
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={onToggleShop}
          className="border border-polygon-warning text-polygon-warning font-bold rounded bg-black/70 hover:bg-polygon-warning hover:text-black transition-all px-6 py-2"
        >
          SHOP<span className="ml-2 text-xs opacity-60">{formatKeyLabel(getBoundKeys(WaveAction.ToggleShop)[0] ?? null)}</span>
        </button>
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={onStartWave}
          className="bg-polygon-primary text-black font-bold rounded hover:bg-green-400 transition-all px-8 py-2"
        >
          START WAVE<span className="ml-2 text-xs opacity-60">{formatKeyLabel(getBoundKeys(WaveAction.StartWave)[0] ?? null)}</span>
        </button>
      </div>
    </div>
  )
}