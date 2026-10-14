import type { BuffSlotState, BuffStatEffect } from '../game/buffs/Buff'
import { BuffStatID } from '../game/data/ID'
import { BuffChip, hexColor, sortBuffs, type ActiveBuff } from './BuffBar'

const STAT_LABEL: Record<string, string> = {
  [BuffStatID.LifeRegen]: 'HP/s',
  [BuffStatID.MoveSpeed]: 'move speed',
  [BuffStatID.Damage]: 'damage',
  [BuffStatID.FireRate]: 'fire rate',
  [BuffStatID.DamageTaken]: 'damage taken',
  [BuffStatID.Defense]: 'defense',
}

function trim(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '')
}

/** One stat line. Values are this application's, not summed across reapplications (stacking is time only). */
function formatStat(effect: BuffStatEffect): string {
  const sign = effect.value < 0 ? '' : '+'
  if (effect.isMultiplier) {
    // A multiplier scales other regen, it isn't HP/s itself
    const label = effect.stat === BuffStatID.LifeRegen ? 'life regen' : STAT_LABEL[effect.stat] ?? effect.stat
    return `${sign}${trim(effect.value * 100)}% ${label}`
  }
  return `${sign}${trim(effect.value)} ${STAT_LABEL[effect.stat] ?? effect.stat}`
}

/** "1:05" past a minute, else "12s". */
function formatTime(ms: number): string {
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function BuffRow({ def, slot }: ActiveBuff) {
  return (
    <li className={`rounded-md border ${def.isDebuff ? 'border-red-500/60' : 'border-green-500/60'} bg-black/50 p-3 flex items-center gap-3`}>
      <BuffChip def={def} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-base" style={{ color: hexColor(def.color) }}>{def.name}</span>
          <span className="text-[10px] uppercase text-gray-400">{def.rarity}</span>
        </div>
        <p className="text-gray-400 text-xs">{def.description}</p>
        {slot.stats.length > 0 && (
          <p className="text-polygon-warning text-xs mt-0.5">{slot.stats.map(formatStat).join(', ')}</p>
        )}
      </div>
      <span className="text-white font-bold text-sm whitespace-nowrap">{formatTime(slot.msLeft)}</span>
    </li>
  )
}

function BuffSection({ title, list }: { title: string; list: ActiveBuff[] }) {
  if (list.length === 0) return null
  return (
    <section>
      <h3 className="text-xs font-bold text-gray-500 mb-2">{title}</h3>
      <ul className="flex flex-col gap-2">
        {list.map(b => <BuffRow key={b.def.id} {...b} />)}
      </ul>
    </section>
  )
}

/** Every active player buff, opened from the pause menu or by tapping the BuffBar. */
export default function ViewBuffs({ buffs, onBack }: {
  buffs: BuffSlotState[]
  onBack: () => void
}) {
  const sorted = sortBuffs(buffs)
  const debuffs = sorted.filter(b => b.def.isDebuff)
  const positive = sorted.filter(b => !b.def.isDebuff)

  return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[110] p-4">
      <h2 className="text-3xl md:text-4xl font-bold text-polygon-primary mb-2">ACTIVE BUFFS</h2>
      <p className="text-gray-400 text-sm mb-4">
        {positive.length} buff{positive.length === 1 ? '' : 's'}, {debuffs.length} debuff{debuffs.length === 1 ? '' : 's'}
      </p>

      <div
        className="w-full max-w-2xl flex-1 max-h-[60vh] overflow-y-auto overscroll-contain border-2 border-polygon-secondary/40 rounded-lg p-3 bg-black/60"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {sorted.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No active buffs.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <BuffSection title="DEBUFFS" list={debuffs} />
            <BuffSection title="BUFFS" list={positive} />
          </div>
        )}
      </div>

      <button
        onClick={onBack}
        onTouchEnd={(e) => { e.preventDefault(); onBack() }}
        className="mt-6 px-8 py-3 border-2 border-polygon-primary text-polygon-primary font-semibold rounded hover:bg-polygon-primary hover:text-black transition-all touch-manipulation select-none"
      >
        BACK
      </button>
    </div>
  )
}
