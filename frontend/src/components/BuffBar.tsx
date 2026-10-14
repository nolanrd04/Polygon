import { useLayoutEffect, useRef, useState } from 'react'
import type { BuffDef, BuffSlotState } from '../game/buffs/Buff'
import { getBuffEntry } from '../game/buffs'
import { IS_MOBILE } from '../game/core/Device'
import { buffBarBounds } from '../game/core/TouchLayout'
import { IconID } from '../game/data/ID'
import { useViewport } from './AbilityDisplay'
import GameIcon from './GameIcon'

const CHIP_SIZE = IS_MOBILE ? 28 : 36
const CHIP_GAP = 4
/** Chips flash once this little time is left. */
const EXPIRING_MS = 3000

const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }

export interface ActiveBuff {
  def: BuffDef
  slot: BuffSlotState
}

/** Active before pending, then debuffs first, then highest rarity, then by name. Shared with ViewBuffs. */
export function sortBuffs(slots: BuffSlotState[]): ActiveBuff[] {
  const active: ActiveBuff[] = []
  for (const slot of slots) {
    const def = getBuffEntry(slot.id)?.def
    if (def) active.push({ def, slot })
  }
  return active.sort((a, b) =>
    Number(!!a.slot.pending) - Number(!!b.slot.pending) ||
    Number(b.def.isDebuff) - Number(a.def.isDebuff) ||
    (RARITY_RANK[b.def.rarity] ?? 0) - (RARITY_RANK[a.def.rarity] ?? 0) ||
    a.def.name.localeCompare(b.def.name)
  )
}

export function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** Compact time for a chip: "12s", or whole minutes past 60 s. */
function chipTime(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m` : `${s}s`
}

/** The tinted square: buff color fill and icon, green (buff) or red (debuff) outline. */
export function BuffChip({ def, size }: { def: BuffDef; size: number }) {
  const color = hexColor(def.color)
  return (
    <div
      className={`rounded border-2 flex items-center justify-center ${def.isDebuff ? 'border-red-500' : 'border-green-500'}`}
      style={{ width: size, height: size, backgroundColor: `${color}33` }}
    >
      <GameIcon
        icon={def.icon}
        fallback={def.isDebuff ? IconID.Debuff : IconID.Buff}
        style={{ color, width: size * 0.7, height: size * 0.7 }}
      />
    </div>
  )
}

/**
 * The player's active buffs as a row of chips at the bottom of the screen —
 * below the joysticks on tall screens, between them on short ones.
 *
 * Shows as many chips as fit the measured width; the rest collapse into a
 * "+N" chip. Tapping the row pauses the game and opens ViewBuffs (`onOpen`).
 * Desktop also gets a hover tooltip per chip.
 */
export default function BuffBar({ buffs, onOpen }: {
  buffs: BuffSlotState[]
  onOpen: () => void
}) {
  const viewport = useViewport()
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const bounds = IS_MOBILE
    ? buffBarBounds(viewport.width, viewport.height)
    : { left: viewport.width * 0.25, right: viewport.width * 0.25, bottom: 16 }

  const sorted = sortBuffs(buffs)
  const fits = Math.max(1, Math.floor((width + CHIP_GAP) / (CHIP_SIZE + CHIP_GAP)))
  const shown = sorted.length > fits ? sorted.slice(0, fits - 1) : sorted
  const hiddenCount = sorted.length - shown.length

  return (
    <div
      ref={ref}
      className="absolute flex justify-center pointer-events-none"
      style={{ left: bounds.left, right: bounds.right, bottom: bounds.bottom }}
    >
      {sorted.length > 0 && (
        <button
          type="button"
          aria-label="View active buffs"
          onClick={onOpen}
          className="flex items-start pointer-events-auto touch-manipulation select-none"
          style={{ gap: CHIP_GAP }}
        >
          {shown.map(({ def, slot }, i) => (
            <div key={`${def.id}-${slot.pending ? `pending-${i}` : 'active'}`} className="relative group flex flex-col items-center">
              <div className={slot.pending ? 'opacity-40' : slot.msLeft <= EXPIRING_MS ? 'animate-pulse' : undefined}>
                <BuffChip def={def} size={CHIP_SIZE} />
              </div>
              <span className="text-[10px] leading-none text-gray-200 mt-0.5">{slot.pending ? 'next' : chipTime(slot.msLeft)}</span>

              {!IS_MOBILE && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 rounded border border-gray-600 bg-black/90 p-2 text-left pointer-events-none z-10">
                  <div className="font-bold text-sm" style={{ color: hexColor(def.color) }}>{def.name}</div>
                  <div className="text-xs text-gray-300">{def.description}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {slot.pending ? `Starts next wave (${Math.ceil(slot.msLeft / 1000)}s)` : `${Math.ceil(slot.msLeft / 1000)}s left`}
                  </div>
                </div>
              )}
            </div>
          ))}

          {hiddenCount > 0 && (
            <div
              className="rounded border-2 border-gray-500 bg-gray-900/80 flex items-center justify-center text-xs font-bold text-gray-200"
              style={{ width: CHIP_SIZE, height: CHIP_SIZE }}
            >
              +{hiddenCount}
            </div>
          )}
        </button>
      )}
    </div>
  )
}
