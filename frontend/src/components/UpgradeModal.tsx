import { useState, useEffect } from 'react'
import statUpgrades from '../game/data/upgrades/stat_upgrades.json'
import effectUpgrades from '../game/data/upgrades/effect_upgrades.json'
import variantUpgrades from '../game/data/upgrades/variant_upgrades.json'
import visualUpgrades from '../game/data/upgrades/visual_upgrades.json'
import abilityUpgrades from '../game/data/upgrades/ability_upgrades.json'
import { UpgradeSystem } from '../game/systems/upgrades'
import { GameManager } from '../game/core/GameManager'
import { EventBus } from '../game/core/EventBus'
import { RARITY_WEIGHTS } from '../game/core/GameConfig'

interface Upgrade {
  id: string
  name: string
  description: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  cost: number
  attackType?: string
  stat?: string
  value?: number
  stackable?: boolean
  maxStacks?: number
  replaces?: string[]
}

interface UpgradeModalProps {
  onStartWave: () => void
  playerPoints: number
  selectedAttack?: string // The attack type the player is using
}

const rarityColors = {
  common: 'border-gray-500 bg-gray-900',
  uncommon: 'border-green-500 bg-green-900/30',
  rare: 'border-blue-500 bg-blue-900/30',
  epic: 'border-purple-500 bg-purple-900/30',
  legendary: 'border-yellow-500 bg-yellow-900/30'
}

const rarityTextColors = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400'
}

export default function UpgradeModal({ onStartWave, playerPoints, selectedAttack = 'bullet' }: UpgradeModalProps) {
  const [options, setOptions] = useState<Upgrade[]>([])
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])  // Track by index, not ID
  const [rerollCost] = useState(1)

  const generateOptions = () => {
    const allUpgrades = [
      ...statUpgrades.upgrades,
      ...effectUpgrades.upgrades,
      ...variantUpgrades.upgrades,
      ...visualUpgrades.upgrades,
      ...abilityUpgrades.upgrades
    ] as Upgrade[]

    // Get already applied upgrades from UpgradeSystem
    const appliedUpgrades = UpgradeSystem.getAppliedUpgrades()

    // Filter upgrades based on selected attack type and availability
    const filteredUpgrades = allUpgrades.filter(upgrade => {
      // Filter by attack type
      if (upgrade.attackType && upgrade.attackType !== selectedAttack) {
        return false
      }

      // Check if non-stackable upgrade is already applied
      if (!upgrade.stackable) {
        const alreadyApplied = appliedUpgrades.some((u: any) => u.id === upgrade.id)
        if (alreadyApplied) {
          return false
        }
      }

      // Check if stackable upgrade has reached max stacks
      if (upgrade.stackable && upgrade.maxStacks) {
        const stackCount = UpgradeSystem.getStackCount(upgrade.id)
        if (stackCount >= upgrade.maxStacks) {
          return false
        }
      }

      // Check if any applied upgrade conflicts with this one
      if (upgrade.replaces) {
        for (const replacedId of upgrade.replaces) {
          const hasConflict = appliedUpgrades.some((u: any) => u.id === replacedId)
          if (hasConflict) {
            return false
          }
        }
      }

      // Check if this upgrade is replaced by any already-applied upgrade
      for (const appliedUpgrade of appliedUpgrades) {
        const appliedFull = allUpgrades.find(u => u.id === appliedUpgrade.id)
        if (appliedFull?.replaces?.includes(upgrade.id)) {
          return false
        }
      }

      return true
    })

    // Group upgrades by rarity
    const upgradesByRarity = {
      common: filteredUpgrades.filter(u => u.rarity === 'common'),
      uncommon: filteredUpgrades.filter(u => u.rarity === 'uncommon'),
      rare: filteredUpgrades.filter(u => u.rarity === 'rare'),
      epic: filteredUpgrades.filter(u => u.rarity === 'epic'),
      legendary: filteredUpgrades.filter(u => u.rarity === 'legendary')
    }

    // Helper function to pick a random rarity based on weights
    const pickRarity = (): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' => {
      const rand = Math.random()
      let cumulative = 0
      
      for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
        cumulative += weight
        if (rand < cumulative) {
          return rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
        }
      }
      
      return 'common' // Fallback
    }

    // Helper function to pick a random upgrade from a rarity tier
    const pickUpgradeFromRarity = (rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'): Upgrade | null => {
      const upgrades = upgradesByRarity[rarity]
      if (upgrades.length === 0) return null
      return upgrades[Math.floor(Math.random() * upgrades.length)]
    }

    // Generate 3 unique upgrades using weighted rarity selection
    const selected: Upgrade[] = []
    let attempts = 0
    const maxAttempts = 100

    while (selected.length < 3 && attempts < maxAttempts) {
      const rarity = pickRarity()
      const upgrade = pickUpgradeFromRarity(rarity)
      
      if (upgrade) {
        // Check if stackable upgrade has reached max stacks
        if (upgrade.stackable && upgrade.maxStacks) {
          const stackCount = UpgradeSystem.getStackCount(upgrade.id)
          if (stackCount >= upgrade.maxStacks) {
            attempts++
            continue // Skip this upgrade if max stacks reached
          }
        }
        
        // Check if upgrade is already in current selection
        const alreadyInSelection = selected.some(u => u.id === upgrade.id)
        
        // Allow duplicates only for stackable upgrades
        if (!alreadyInSelection || upgrade.stackable) {
          selected.push(upgrade)
        }
      }
      
      attempts++
    }

    // Ensure exactly 3 upgrades
    setOptions(selected.length > 3 ? selected.slice(0, 3) : selected)
  }

  useEffect(() => {
    generateOptions()
  }, [])

  const handleReroll = () => {
    if (playerPoints >= rerollCost) {
      GameManager.addPoints(-rerollCost)
      setSelectedIndices([])  // Reset selected indices for new roll
      setOptions([])  // Clear old options to prevent sticking
      generateOptions()
    }
  }

  const handleUpgradeClick = (upgrade: Upgrade, index: number) => {
    // Check if can afford
    const stats = GameManager.getPlayerStats()
    if (stats.points < upgrade.cost) {
      return
    }

    // Try to apply the upgrade
    EventBus.emit('upgrade-selected', upgrade.id)

    // Add index to selected list (not ID, to allow buying same upgrade twice)
    setSelectedIndices([...selectedIndices, index])
  }

  const isUpgradeDisabled = (upgrade: Upgrade, index: number): boolean => {
    const stats = GameManager.getPlayerStats()

    // Can't afford
    if (stats.points < upgrade.cost) {
      return true
    }

    // Check if any selected upgrade conflicts with this one
    for (const selectedIndex of selectedIndices) {
      const selectedUpgrade = options[selectedIndex]
      if (selectedUpgrade?.replaces?.includes(upgrade.id)) {
        return true
      }
    }

    // Check if this upgrade conflicts with any selected upgrade
    if (upgrade.replaces) {
      for (const replacedId of upgrade.replaces) {
        for (const selectedIndex of selectedIndices) {
          if (options[selectedIndex]?.id === replacedId) {
            return true
          }
        }
      }
    }

    return false
  }

  const handleStartWave = () => {
    onStartWave()
  }

  return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
      <h2 className="text-3xl font-bold text-polygon-primary mb-8">
        SELECT AN UPGRADE
      </h2>

      <div className="flex gap-6 mb-8">
        {options.map((upgrade, index) => {
          const isDisabled = isUpgradeDisabled(upgrade, index)
          // Mark as purchased if THIS SPECIFIC INDEX was selected
          const isPurchased = selectedIndices.includes(index)
          const stats = GameManager.getPlayerStats()
          const canAfford = stats.points >= upgrade.cost

          return (
            <button
              key={`${upgrade.id}-${index}`}
              onClick={() => !isDisabled && !isPurchased && handleUpgradeClick(upgrade, index)}
              disabled={isDisabled || isPurchased}
              className={`w-64 p-6 rounded-lg border-2 ${rarityColors[upgrade.rarity]} ${
                isPurchased ? 'bg-green-900/50 border-green-500' : ''
              } ${
                !isDisabled && !isPurchased ? 'hover:scale-105 cursor-pointer' : 'opacity-50 cursor-not-allowed'
              } transition-all flex flex-col`}
            >
              <div className={`text-sm font-bold uppercase ${rarityTextColors[upgrade.rarity]}`}>
                {upgrade.rarity}
              </div>
              <h3 className="text-xl font-bold text-white mt-2 mb-2">
                {upgrade.name}
              </h3>
              <p className="text-gray-400 text-sm flex-grow">
                {upgrade.description}
              </p>
              {upgrade.attackType && (
                <div className="mt-3 text-xs text-polygon-secondary">
                  {upgrade.attackType.toUpperCase()}
                </div>
              )}
              <div className={`mt-3 font-bold ${
                isPurchased ? 'text-green-400' :
                canAfford && !isDisabled ? 'text-polygon-warning' : 'text-red-500'
              }`}>
                {isPurchased ? 'PURCHASED' : `${upgrade.cost} PTS ${!canAfford ? '(Cannot Afford)' : isDisabled ? '(Conflicts)' : ''}`}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 items-center mb-4">
        <button
          onClick={handleReroll}
          disabled={playerPoints < rerollCost}
          className="px-6 py-2 border border-gray-600 text-gray-400 rounded hover:border-polygon-warning hover:text-polygon-warning transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          REROLL ({rerollCost} PTS)
        </button>

        <button
          onClick={handleStartWave}
          className="px-8 py-3 bg-polygon-primary text-black font-bold text-lg rounded hover:bg-green-400 transition-all"
        >
          START WAVE
        </button>
      </div>

      <p className="mt-2 text-gray-600 text-sm">
        Your Points: {playerPoints.toLocaleString()}
      </p>

      {selectedIndices.length > 0 && (
        <p className="text-green-400 text-sm mt-1">
          {selectedIndices.length} upgrade{selectedIndices.length > 1 ? 's' : ''} purchased
        </p>
      )}
    </div>
  )
}
