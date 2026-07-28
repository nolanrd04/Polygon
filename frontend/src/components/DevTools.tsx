import { useState } from 'react'
import { UpgradeSystem } from '../game/systems/upgrades'
import { getAllUpgrades } from '../game/upgrades'
import type { UpgradeDef } from '../game/upgrades/Upgrade'
import { EventBus } from '../game/core/EventBus'
import { ATTACK_INFO, type AttackType } from '../game/data/attackTypes'

interface DevToolsProps {
  onToggleCollisionBoxes: () => void
  showCollisionBoxes: boolean
}

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

export default function DevTools({ onToggleCollisionBoxes, showCollisionBoxes }: DevToolsProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (isMobile) return null
  const [selectedCategory, setSelectedCategory] = useState<'stat' | 'effect' | 'variant' | 'visual' | 'ability' | 'enemies'>('stat')
  const [selectedAttack, setSelectedAttack] = useState<AttackType>('bullet')
  const [waveInput, setWaveInput] = useState('1')
  const [refreshKey, setRefreshKey] = useState(0)

  const allUpgrades = {
    stat: getAllUpgrades().filter(u => u.upgradeType === 'stat_modifier' && !u.curse),
    effect: getAllUpgrades().filter(u => u.upgradeType === 'effect' && !u.curse),
    variant: getAllUpgrades().filter(u => u.upgradeType === 'variant' && !u.curse),
    visual: getAllUpgrades().filter(u => u.upgradeType === 'visual_effect' && !u.curse),
    ability: getAllUpgrades().filter(u => u.upgradeType === 'ability' && !u.curse)
  }

  const enemyTypes = [
    { id: 'triangle', name: 'Triangle', description: 'Basic enemy' },
    { id: 'square', name: 'Square', description: 'Faster enemy' },
    { id: 'pentagon', name: 'Pentagon', description: 'Tanky enemy' },
    { id: 'hexagon', name: 'Hexagon', description: 'Enemy with shield' },
    { id: 'diamond', name: 'Diamond', description: 'Dashes at player' },
    { id: 'octogon', name: 'Octogon', description: 'Tanky enemy that splits on death' },
    { id: 'super_triangle', name: 'Super Triangle', description: 'Ranged attacker' },
    { id: 'super_square', name: 'Super Square', description: 'Enhanced square that shoots an acid projectile' },
    { id: 'super_pentagon', name: 'Super Pentagon', description: 'Enemy that teleports and detonates on death' },
    { id: 'super_hexagon', name: 'Super Hexagon', description: 'Enemy with shield that shoots acid projectiles' },
    { id: 'dodecahedron', name: 'Dodecahedron', description: 'Boss enemy with high health' }
  ]

  const handleApplyUpgrade = (upgrade: UpgradeDef) => {
    // Emit dev-only event that bypasses point cost
    EventBus.emit('dev-apply-upgrade', upgrade.id)
    console.log('✅ Applied (FREE):', upgrade.name)

    // Force re-render to show updated stack count
    setTimeout(() => setRefreshKey(prev => prev + 1), 100)
  }

  const handleRemoveUpgrade = (upgrade: UpgradeDef, e: React.MouseEvent) => {
    e.preventDefault() // Prevent context menu
    EventBus.emit('dev-remove-upgrade' as any, upgrade.id)
    console.log('❌ Removed:', upgrade.name)

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

  const handleSpawnEnemy = (enemyType: string) => {
    EventBus.emit('dev-spawn-enemy' as any, enemyType)
    console.log(`Spawned ${enemyType}`)
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
    <div className="fixed bottom-4 right-4 w-[420px] bg-gray-900 border-2 border-purple-500 rounded-lg shadow-2xl z-50 max-h-screen overflow-hidden flex flex-col">
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
        {(['stat', 'effect', 'variant', 'visual', 'ability', 'enemies'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-1 py-2 px-1 text-[10px] font-mono uppercase ${
              selectedCategory === cat
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat === 'enemies' ? 'enemy' : cat}
          </button>
        ))}
      </div>

      {/* Attack Type Filter */}
      {selectedCategory !== 'enemies' && (
        <div className="flex border-b border-gray-700 flex-wrap gap-1 p-2">
          {(Object.keys(ATTACK_INFO) as AttackType[]).map(attack => (
            <button
              key={attack}
              onClick={() => setSelectedAttack(attack)}
              className={`py-1 px-2 text-[10px] font-mono uppercase rounded ${
                selectedAttack === attack
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {attack}
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {selectedCategory === 'enemies' ? (
          // Enemy Spawn List
          enemyTypes.map((enemy) => (
            <button
              key={enemy.id}
              onClick={() => handleSpawnEnemy(enemy.id)}
              className="w-full text-left p-2 rounded text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-white">{enemy.name}</div>
                  <div className="text-gray-400 text-xs">{enemy.description}</div>
                </div>
                <div className="text-purple-400 text-xs">SPAWN</div>
              </div>
            </button>
          ))
        ) : (
          // Upgrade List with Attack Type Filtering
          allUpgrades[selectedCategory]
            .filter(upgrade => {
              // Filter by attack type
              if (upgrade.specificAttackType && upgrade.specificAttackType !== selectedAttack) {
                return false
              }
              return true
            })
            .map((upgrade) => {
              const stackCount = UpgradeSystem.getStackCount(upgrade.id)
              const applied = stackCount > 0

              return (
                <button
                  key={`${upgrade.id}-${refreshKey}`}
                  onClick={() => handleApplyUpgrade(upgrade)}
                  onContextMenu={(e) => handleRemoveUpgrade(upgrade, e)}
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
            })
        )}
      </div>
    </div>
  )
}
