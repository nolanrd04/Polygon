import { useMemo } from 'react'
import statUpgrades from '../game/data/upgrades/stat_upgrades.json'
import effectUpgrades from '../game/data/upgrades/effect_upgrades.json'
import variantUpgrades from '../game/data/upgrades/variant_upgrades.json'
import visualUpgrades from '../game/data/upgrades/visual_upgrades.json'
import abilityUpgrades from '../game/data/upgrades/ability_upgrades.json'
import { GameManager } from '../game/core/GameManager'

interface UpgradeDef {
  id: string
  name: string
  description: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  type?: string
  target?: string
  attackType?: string
  stat?: string
  effect?: string
  value?: number
  effectValue?: number
  isMultiplier?: boolean
}

interface ViewUpgradesProps {
  onBack: () => void
}

interface UpgradeGroup {
  name: string
  rarity: UpgradeDef['rarity']
  count: number
  totalLabel: string
  description: string
}

const rarityRank: Record<UpgradeDef['rarity'], number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4
}

const rarityBorder: Record<UpgradeDef['rarity'], string> = {
  common: 'border-gray-500',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-yellow-500'
}

const rarityText: Record<UpgradeDef['rarity'], string> = {
  common: 'text-gray-300',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400'
}

const ALL_UPGRADES: UpgradeDef[] = [
  ...statUpgrades.upgrades,
  ...effectUpgrades.upgrades,
  ...variantUpgrades.upgrades,
  ...visualUpgrades.upgrades,
  ...abilityUpgrades.upgrades
] as UpgradeDef[]

function formatValue(unit: string, total: number, isMultiplier: boolean): string {
  if (isMultiplier) {
    const pct = total * 100
    const rounded = Math.abs(pct) < 0.01 ? pct.toFixed(3) : pct.toFixed(2).replace(/\.?0+$/, '')
    return `+${rounded}% ${unit}`
  }
  const rounded = Number.isInteger(total) ? total.toString() : total.toFixed(2).replace(/\.?0+$/, '')
  return `+${rounded} ${unit}`
}

function buildGroups(applied: string[]): UpgradeGroup[] {
  const byId = new Map<string, {
    def: UpgradeDef
    count: number
  }>()

  for (const id of applied) {
    const def = ALL_UPGRADES.find(u => u.id === id)
    if (!def) continue

    const entry = byId.get(id)
    if (entry) {
      entry.count++
    } else {
      byId.set(id, { def, count: 1 })
    }
  }

  const groups: UpgradeGroup[] = []
  for (const { def, count } of byId.values()) {
    const numeric = def.value ?? def.effectValue
    let totalLabel: string
    if (typeof numeric === 'number') {
      const unit =
        def.attackType && def.stat ? `${def.attackType} ${def.stat}` :
        def.stat ? def.stat :
        def.effect ? def.effect :
        def.target ? def.target :
        'value'
      totalLabel = formatValue(unit, numeric * count, !!def.isMultiplier)
    } else if (def.type === 'variant' || def.type === 'visual_effect' || def.type === 'ability') {
      totalLabel = 'Active'
    } else {
      totalLabel = '—'
    }

    groups.push({
      name: def.name,
      rarity: def.rarity,
      count,
      totalLabel,
      description: def.description
    })
  }

  // Sort: highest rarity first, then by count desc, then name
  groups.sort((a, b) => {
    if (rarityRank[b.rarity] !== rarityRank[a.rarity]) {
      return rarityRank[b.rarity] - rarityRank[a.rarity]
    }
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name)
  })

  return groups
}

export default function ViewUpgrades({ onBack }: ViewUpgradesProps) {
  const groups = useMemo(() => {
    const applied = GameManager.getState().appliedUpgrades
    return buildGroups(applied)
  }, [])

  const totalCount = groups.reduce((sum, g) => sum + g.count, 0)

  return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[110] p-4">
      <h2 className="text-3xl md:text-4xl font-bold text-polygon-primary mb-2">PURCHASED UPGRADES</h2>
      <p className="text-gray-400 text-sm mb-4">
        {totalCount} upgrade{totalCount === 1 ? '' : 's'} across {groups.length} type{groups.length === 1 ? '' : 's'}
      </p>

      <div
        className="w-full max-w-2xl flex-1 max-h-[60vh] overflow-y-auto overscroll-contain border-2 border-polygon-secondary/40 rounded-lg p-3 bg-black/60"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {groups.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No upgrades purchased yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map(g => (
              <li
                key={g.name}
                className={`rounded-md border ${rarityBorder[g.rarity]} bg-black/50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`font-bold text-base ${rarityText[g.rarity]}`}>{g.name}</span>
                    <span className={`text-[10px] uppercase ${rarityText[g.rarity]}`}>{g.rarity}</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate">{g.description}</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 text-sm whitespace-nowrap">
                  <span className="text-gray-300">
                    x<span className="text-white font-bold">{g.count}</span>
                  </span>
                  <span className="text-polygon-warning font-semibold">{g.totalLabel}</span>
                </div>
              </li>
            ))}
          </ul>
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