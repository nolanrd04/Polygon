import { useState } from 'react'
import { type UpgradeDefinition, UpgradeSystem } from '../game/systems/upgrades'
import { EventBus } from '../game/core/EventBus'
import statUpgrades from '../game/data/upgrades/stat_upgrades.json'
import effectUpgrades from '../game/data/upgrades/effect_upgrades.json'
import variantUpgrades from '../game/data/upgrades/variant_upgrades.json'
import visualUpgrades from '../game/data/upgrades/visual_upgrades.json'
import abilityUpgrades from '../game/data/upgrades/ability_upgrades.json'

interface DevToolsProps {
  onToggleCollisionBoxes: () => void
  showCollisionBoxes: boolean
}

export default function DevTools({ onToggleCollisionBoxes, showCollisionBoxes }: DevToolsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'stat' | 'effect' | 'variant' | 'visual' | 'ability'>('stat')
  const [waveInput, setWaveInput] = useState('1')
  const [refreshKey, setRefreshKey] = useState(0)

  const allUpgrades = {
    stat: statUpgrades.upgrades,
    effect: effectUpgrades.upgrades,
    variant: variantUpgrades.upgrades,
    visual: visualUpgrades.upgrades,
    ability: abilityUpgrades.upgrades
  }

  const handleApplyUpgrade = (upgrade: UpgradeDefinition) => {
    // Emit dev-only event that bypasses point cost
    EventBus.emit('dev-apply-upgrade', upgrade.id)
    console.log('✅ Applied (FREE):', upgrade.name)

    // Force re-render to show updated stack count
    setTimeout(() => setRefreshKey(prev => prev + 1), 100)
  }

  const handleReset = () => {
    UpgradeSystem.reset()
    console.log('🔄 Reset all upgrades')
    setRefreshKey(prev => prev + 1)
  }

  const handleSetWave = () => {
    const wave = parseInt(waveInput)
    if (!isNaN(wave) && wave >= 1) {
      EventBus.emit('set-wave' as any, wave)
      console.log(`🌊 Set wave to ${wave}`)
    } else {
      console.warn('❌ Invalid wave number')
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 font-mono text-sm"
      >
        DEV TOOLS
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-gray-900 border-2 border-purple-500 rounded-lg shadow-2xl z-50 max-h-screen overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-purple-600 p-3 flex justify-between items-center">
        <h3 className="font-mono font-bold text-white">DEV TOOLS</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:text-red-400 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Controls */}
      <div className="p-3 space-y-2 border-b border-gray-700">
        <button
          onClick={onToggleCollisionBoxes}
          className={`w-full py-2 px-3 rounded font-mono text-sm ${
            showCollisionBoxes
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {showCollisionBoxes ? '✓ Collision Boxes ON' : 'Collision Boxes OFF'}
        </button>

        <button
          onClick={handleReset}
          className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded font-mono text-sm"
        >
          Reset All Upgrades
        </button>

        {/* Wave Setter */}
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={waveInput}
            onChange={(e) => setWaveInput(e.target.value)}
            placeholder="Wave"
            className="flex-1 px-3 py-2 bg-gray-800 text-white rounded font-mono text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
          />
          <button
            onClick={handleSetWave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-mono text-sm"
          >
            Set Wave
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-gray-700">
        {(['stat', 'effect', 'variant', 'visual', 'ability'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-1 py-2 px-2 text-xs font-mono uppercase ${
              selectedCategory === cat
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Upgrade List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {allUpgrades[selectedCategory].map((upgrade) => {
          const applied = UpgradeSystem.getAppliedUpgrades().some(u => u.id === upgrade.id)
          const stackCount = UpgradeSystem.getStackCount(upgrade.id)

          return (
            <button
              key={`${upgrade.id}-${refreshKey}`}
              onClick={() => handleApplyUpgrade(upgrade as UpgradeDefinition)}
              className={`w-full text-left p-2 rounded text-xs ${
                applied
                  ? 'bg-green-900 border border-green-500'
                  : 'bg-gray-800 hover:bg-gray-700 border border-gray-600'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-white">{upgrade.name}</div>
                  <div className="text-gray-400 text-xs">{upgrade.description}</div>
                </div>
                {stackCount > 0 && (
                  <div className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-bold">
                    x{stackCount}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
