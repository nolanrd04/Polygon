import { useEffect, useState } from 'react'
import type { AbilitySlotState } from '../game/systems/AbilitySystem'
import { IS_MOBILE } from '../game/core/Device'
import { EventBus } from '../game/core/EventBus'
import { abilityPadPosition, TOUCH_LAYOUT } from '../game/core/TouchLayout'
import { hudBlockBottom } from './GameHUD'
import { perfOverlayBottom } from './PerfOverlay'

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

/** Desktop readout: a wide card in a top-left stack. Never interactive. */
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
 * Mobile control: a square pad sitting in the slot the on-canvas ability button
 * used to occupy, carrying the same readout the desktop card does.
 *
 * Shape and position both come from `abilityPadPosition()`, so these land exactly
 * where the Phaser buttons did relative to the joysticks — the layout constants
 * are shared with TouchControlManager rather than copied.
 *
 * The key chip is dropped: it is keyboard-only information, and in 65px the room
 * is better spent on the name. Cooldown reads two ways at once — a scrim wiping
 * down the pad, and the progress bar underneath the label.
 */
function AbilityPad({ slot, left, top, size }: {
  slot: AbilitySlotState
  left: number
  top: number
  size: number
}) {
  const atFullCharge = slot.recharges && slot.ready > 0
  const theme = atFullCharge ? THEMES.green : THEMES[slot.theme] ?? THEMES.blue

  // Firing with no charge left does nothing (AbilitySystem.activate guards it),
  // but the pad should look inert rather than merely fail silently.
  const usable = slot.ready > 0

  return (
    <button
      type="button"
      aria-label={`Use ${slot.label}`}
      disabled={!usable}
      style={{ left, top, width: size, height: size }}
      onPointerDown={event => {
        // Fire on contact, not on release — waiting for pointerup feels laggy
        // mid-fight. preventDefault keeps the tap from also becoming a synthetic
        // mouse event on the canvas underneath.
        event.preventDefault()
        EventBus.emit('activate-ability', slot.id)
      }}
      className={`absolute overflow-hidden rounded-lg border bg-gray-900/80 p-1 pointer-events-auto touch-manipulation select-none transition-opacity active:opacity-60 ${theme.border} ${
        usable ? '' : 'opacity-50'
      }`}
    >
      {/* Cooldown wipe: covers the share of the pad still to recharge. */}
      {!usable && slot.recharges && (
        <div
          className="absolute inset-x-0 top-0 bg-black/60 transition-all duration-100"
          style={{ height: `${(1 - slot.progress) * 100}%` }}
        />
      )}

      <div className="relative flex h-full flex-col items-center justify-center gap-1">
        <span className={`font-bold leading-none text-[11px] ${theme.text}`}>{slot.label}</span>

        {slot.recharges ? (
          <div className="relative h-1.5 w-full overflow-hidden rounded-full border border-gray-700 bg-gray-800">
            <div
              className={`h-full transition-all duration-100 ${theme.bar}`}
              style={{ width: `${slot.progress * 100}%` }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-0.5">
            {Array.from({ length: Math.min(slot.ready, 5) }).map((_, i) => (
              <div key={i} className={`h-2 w-2 rounded-sm ${theme.pip}`} />
            ))}
          </div>
        )}
      </div>

      {/* Charge count, only where more than one is possible. */}
      {slot.max > 1 && (
        <span className={`absolute bottom-0.5 right-1 text-[10px] font-bold leading-none ${theme.text}`}>
          {slot.ready}
        </span>
      )}
    </button>
  )
}

/**
 * Screen Y the ability pad stack must stay below: the bottom of whichever top HUD
 * element reaches lowest, plus clearance.
 *
 * Each component reports its own extent rather than this file guessing at another
 * one's Tailwind — `hudBlockBottom()` covers the health readout (left) and the
 * wave/points block (right), `perfOverlayBottom()` the FPS readout parked under
 * the wave block, returning 0 when it is switched off.
 *
 * One ceiling for both columns keeps the pairs level with each other. The right
 * column is normally what sets it: the wave block is taller than the health
 * block, and the perf overlay sits below that again.
 */
function abilityCeiling(): number {
  return Math.max(hudBlockBottom(), perfOverlayBottom()) + TOUCH_LAYOUT.abilityHudClearance
}

/**
 * Viewport size in CSS pixels, tracked so the pads can be placed against the
 * joysticks. `Phaser.Scale.RESIZE` sizes the canvas 1:1 with the viewport, so
 * this is the same coordinate space the canvas controls are laid out in.
 */
function useViewport() {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  return size
}

/**
 * The player's usable abilities. Entirely driven by the slots AbilitySystem
 * reports, so a new ability shows up here with no edit.
 *
 * DESKTOP: a passive readout, stacked top-left.
 *
 * MOBILE: THESE ARE THE ABILITY BUTTONS. Square pads in the slots the on-canvas
 * buttons used to hold — see abilityPadPosition() in TouchLayout.ts. The two used
 * to be drawn as separate things that duplicated every field except the key
 * label, and then had to be laid out around each other; now there is one control
 * that both shows the state and fires the ability, via `activate-ability`.
 *
 * The container is `pointer-events-none` so bare space still passes touches
 * through to the canvas — the joysticks read raw DOM events on it — and each pad
 * re-enables pointer events for itself.
 */
export default function AbilityDisplay({ slots, bindingCount }: {
  slots: AbilitySlotState[]
  bindingCount: number
}) {
  const viewport = useViewport()
  // Captured once, like PerfOverlay captures its own mode: the FPS readout does
  // not appear or disappear mid-run, and re-reading settings on every 100 ms poll
  // would touch localStorage ten times a second for a value that cannot change.
  const [ceiling] = useState(abilityCeiling)

  if (slots.length === 0) return null

  if (!IS_MOBILE) {
    return (
      <div className="absolute top-24 left-4 pointer-events-none">
        <div className="flex flex-col gap-2">
          {slots.map(slot => (
            <AbilityCard key={slot.id} slot={slot} />
          ))}
        </div>
      </div>
    )
  }

  // bindingCount can still be 0 on the first frames, before MainScene has
  // answered the first poll. Fall back to what is on screen so the pads are never
  // laid out for an empty stack.
  const padCount = Math.max(bindingCount, ...slots.map(slot => slot.index + 1))

  return (
    <div className="absolute inset-0 pointer-events-none">
      {slots.map(slot => {
        const { left, top, size } = abilityPadPosition(
          slot.index,
          viewport.width,
          viewport.height,
          ceiling,
          padCount
        )
        return <AbilityPad key={slot.id} slot={slot} left={left} top={top} size={size} />
      })}
    </div>
  )
}
