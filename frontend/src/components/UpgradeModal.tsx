import { useState, useEffect } from 'react'
import { getAllUpgrades } from '../game/upgrades'
import type { UpgradeDef } from '../game/upgrades/Upgrade'
import { RarityID, IconID } from '../game/data/ID'
import GameIcon from './GameIcon'
import { GameManager } from '../game/core/GameManager'
import { EventBus } from '../game/core/EventBus'
import { waveValidation } from '../game/services/WaveValidation'
import { NormalDifficulty } from '../game/systems/difficulty/Normal'
import {
  FRAGMENT_COLORS,
  FRAGMENT_TIERS,
  FRAGMENT_WORTH,
  REROLL_PRICE,
  canAffordFragments,
  getConversionCost,
  getConversionStep,
  getMaxConversion,
  getRollPrice,
  planAutoConversion,
  planPayment,
  type FragmentCounts,
} from '../game/systems/FragmentBudget'
import FragmentIcon, { FragmentRow } from './FragmentIcon'

/**
 * UPGRADE ARCHITECTURE:
 *
 * Upgrades are managed using a hybrid backend/frontend approach:
 *
 * BACKEND (backend/app/core/upgrade_data.py):
 * - Contains the source of truth for all upgrade definitions
 * - Handles upgrade rolling (3 random upgrades based on rarity weights)
 * - Validates upgrade selection (dependencies, max stacks, cost)
 * - Returns only upgrade IDs to the frontend
 *
 * FRONTEND (frontend/src/game/upgrades/): def/ctor registry (UPGRADE_REGISTRY)
 * - Contains a copy of the same upgrade data for display purposes
 * - UI code consumes the plain UpgradeDef half only — behavior classes are
 *   instantiated by the game engine, never by components
 * - Used to look up full upgrade details (name, description, rarity) based on IDs from backend
 * - Enables rendering upgrade cards in the UI
 * - Used by DevTools for development upgrade selection
 *
 * This architecture prevents client-side manipulation while keeping UI rendering fast.
 */

type Upgrade = UpgradeDef & { purchased?: boolean; discounted?: boolean }

interface UpgradeModalProps {
  onStartWave: () => void
  /** Back to the intermission field without starting the wave. */
  onClose: () => void
  fragments: FragmentCounts
  selectedAttack?: string // The attack type the player is using
}

const rarityColors: Record<RarityID, string> = {
  common: 'border-gray-500 bg-gray-900',
  uncommon: 'border-green-500 bg-green-900/30',
  rare: 'border-blue-500 bg-blue-900/30',
  epic: 'border-purple-500 bg-purple-900/30',
  legendary: 'border-yellow-500 bg-yellow-900/30'
}

const rarityTextColors: Record<RarityID, string> = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400'
}

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

type ShopTab = 'roll' | 'convert' | 'upgrades' | 'buildables'

const SHOP_TABS: { id: ShopTab; label: string; shortLabel: string; comingSoon?: boolean }[] = [
  { id: 'roll', label: 'Roll Upgrades', shortLabel: 'Roll' },
  { id: 'convert', label: 'Convert Fragments', shortLabel: 'Convert' },
  { id: 'upgrades', label: 'Purchase Upgrades', shortLabel: 'Upgrades', comingSoon: true },
  { id: 'buildables', label: 'Purchase Buildables', shortLabel: 'Buildables', comingSoon: true },
]

/** The bordered box every shop tab sits in; Close / Start Wave stay outside it. */
const SHOP_PANEL_CLASS = `flex flex-col items-center rounded-lg border-2 border-gray-700 bg-black/60 ${isMobile ? 'mb-3 p-2' : 'mb-6 p-6'}`

function TierPicker({ label, selected, fragments, onSelect }: {
  label: string
  selected: RarityID
  fragments: FragmentCounts
  onSelect: (tier: RarityID) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-gray-400 ${isMobile ? 'w-8 text-[10px]' : 'w-12 text-sm'}`}>{label}</span>
      {FRAGMENT_TIERS.map(tier => (
        <button
          key={tier}
          onClick={() => onSelect(tier)}
          aria-label={`${label} ${tier}`}
          className={`flex items-center justify-center gap-1 rounded border-2 tabular-nums transition-all ${
            tier === selected ? 'bg-white/10' : 'border-gray-700 hover:border-gray-500'
          } ${isMobile ? 'w-14 py-1 text-[10px]' : 'w-24 py-2 text-sm'}`}
          style={{ color: FRAGMENT_COLORS[tier], borderColor: tier === selected ? FRAGMENT_COLORS[tier] : undefined }}
        >
          <FragmentIcon tier={tier} size={isMobile ? 10 : 16} />
          {fragments[tier].toLocaleString()}
        </button>
      ))}
    </div>
  )
}

// Digits only; the cap keeps a pasted number from blowing up the layout.
const MAX_AMOUNT_DIGITS = 9

function ConvertPanel({ fragments }: { fragments: FragmentCounts }) {
  const [from, setFrom] = useState<RarityID>(RarityID.Common)
  const [to, setTo] = useState<RarityID>(RarityID.Uncommon)
  // Kept as text so the field can be empty mid-edit.
  const [draft, setDraft] = useState('1')

  const amount = parseInt(draft, 10) || 0
  const step = getConversionStep(from, to)
  const max = getMaxConversion(fragments, from, to)
  const cost = getConversionCost(from, to, amount)
  const canConvert = amount >= step && amount % step === 0 && cost <= fragments[from]
  const isUp = FRAGMENT_WORTH[to] > FRAGMENT_WORTH[from]
  const stepButtonClass = `border border-gray-600 text-gray-300 rounded hover:border-white hover:text-white transition-all ${isMobile ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-sm'}`

  const setAmount = (value: number) => setDraft(String(value))

  /** Snaps to a whole batch between one step and the max. */
  const clampAmount = (value: number, s: number = step, m: number = max) => {
    const batches = Math.floor(Math.min(value, Math.max(s, m)) / s)
    return Math.max(1, batches) * s
  }

  const selectFrom = (tier: RarityID) => {
    // Same tier as To: move To to the neighbouring tier.
    const nextTo = tier !== to ? to : FRAGMENT_TIERS[FRAGMENT_TIERS.indexOf(tier) + 1] ?? FRAGMENT_TIERS[FRAGMENT_TIERS.indexOf(tier) - 1]
    setFrom(tier)
    setTo(nextTo)
    setAmount(getConversionStep(tier, nextTo))
  }

  const selectTo = (tier: RarityID) => {
    // Same tier as From: From drops to the lowest other tier that can pay, so swapping is one click.
    let nextFrom = from
    if (tier === from) {
      const others = FRAGMENT_TIERS.filter(t => t !== tier)
      nextFrom = others.find(t => getMaxConversion(fragments, t, tier) > 0) ?? others[0]
    }
    setFrom(nextFrom)
    setTo(tier)
    setAmount(getConversionStep(nextFrom, tier))
  }

  const changeAmount = (delta: number) => setAmount(clampAmount(amount + delta * step))

  const handleTyped = (value: string) => setDraft(value.replace(/\D/g, '').slice(0, MAX_AMOUNT_DIGITS))

  const handleConvert = async () => {
    if (await waveValidation.convertFragments(from, to, amount)) {
      setAmount(step)
    }
  }

  return (
    <div className={`${SHOP_PANEL_CLASS} ${isMobile ? 'gap-1.5' : 'gap-3'}`}>
      <TierPicker label="From" selected={from} fragments={fragments} onSelect={selectFrom} />
      <TierPicker label="To" selected={to} fragments={fragments} onSelect={selectTo} />

      <div className={`flex items-center ${isMobile ? 'gap-1 mt-1' : 'gap-2 mt-2'}`}>
        <button onClick={() => changeAmount(-10)} className={stepButtonClass}>-10</button>
        <button onClick={() => changeAmount(-1)} className={stepButtonClass}>-1</button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Amount to convert"
          value={draft}
          onChange={e => handleTyped(e.target.value)}
          onBlur={() => setAmount(clampAmount(amount))}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className={`text-center font-bold text-white tabular-nums bg-transparent border-b-2 border-gray-600 focus:border-polygon-primary outline-none ${isMobile ? 'w-12 text-xs' : 'w-24 text-lg'}`}
        />
        <button onClick={() => changeAmount(1)} className={stepButtonClass}>+1</button>
        <button onClick={() => changeAmount(10)} className={stepButtonClass}>+10</button>
        <button onClick={() => setAmount(clampAmount(max))} className={stepButtonClass}>MAX</button>
      </div>

      <div className={`flex items-center gap-2 font-bold ${isMobile ? 'text-xs' : 'text-lg'}`}>
        <span className={`flex items-center gap-1 ${canConvert ? 'text-white' : 'text-red-500'}`}>
          Spend <FragmentIcon tier={from} size={isMobile ? 12 : 18} /> {cost.toLocaleString()}
        </span>
        <span className="text-gray-500">→</span>
        <span className="flex items-center gap-1 text-white">
          Get <FragmentIcon tier={to} size={isMobile ? 12 : 18} /> {amount.toLocaleString()}
        </span>
        {isUp && (
          <span className={`font-normal text-gray-500 ${isMobile ? 'text-[8px]' : 'text-xs'}`}>
            (+20% for converting upwards)
          </span>
        )}
      </div>

      <button
        onClick={handleConvert}
        disabled={!canConvert}
        className={`bg-polygon-primary text-black font-bold rounded hover:bg-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'px-4 py-1 text-xs' : 'px-8 py-2'}`}
      >
        CONVERT
      </button>
    </div>
  )
}

export default function UpgradeModal({ onStartWave, onClose, fragments }: UpgradeModalProps) {
  const [tab, setTab] = useState<ShopTab>('roll')
  const [options, setOptions] = useState<Upgrade[]>([])
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])  // Track by index, not ID
  const canAffordReroll = canAffordFragments(fragments, REROLL_PRICE)
  const [autoConvert, setAutoConvert] = useState(waveValidation.autoConvert)

  const toggleAutoConvert = (enabled: boolean) => {
    waveValidation.autoConvert = enabled
    setAutoConvert(enabled)
  }

  const loadBackendUpgrades = () => {
    // Get all available upgrades
    const allUpgrades = getAllUpgrades().filter(u => !u.curse) as Upgrade[]

    // Get upgrade IDs from backend (rolled server-side)
    const offeredUpgradeIds = waveValidation.getOfferedUpgrades()

    console.log('Raw offeredUpgradeIds from backend:', offeredUpgradeIds)

    if (!offeredUpgradeIds || offeredUpgradeIds.length === 0) {
      console.warn('No upgrades offered from backend')
      setOptions([])
      return
    }

    // Check if backend returned full upgrade objects or just IDs
    const firstItem = offeredUpgradeIds[0]
    const isFullObject = typeof firstItem === 'object' && firstItem !== null && 'id' in firstItem

    let offeredUpgrades: Upgrade[]
    if (isFullObject) {
      // Backend returned full upgrade objects with purchase status
      console.log('Backend returned full upgrade objects')
      offeredUpgrades = offeredUpgradeIds.map((item: any) => {
        const upgrade = allUpgrades.find(u => u.id === item.id)
        if (upgrade) {
          // Attach purchase status from backend
          return { ...upgrade, purchased: item.purchased, discounted: item.discounted } as Upgrade
        }
        return null
      }).filter(u => u !== null) as Upgrade[]
    } else {
      // Backend returned just IDs - map to full upgrade objects
      console.log('Backend returned upgrade IDs, mapping to full objects')
      offeredUpgrades = offeredUpgradeIds
        .map(id => allUpgrades.find(u => u.id === id))
        .filter(u => u !== undefined) as Upgrade[]
    }

    console.log(`Loaded ${offeredUpgrades.length} upgrades from backend:`, offeredUpgrades)
    setOptions(offeredUpgrades)
    // The shop can be closed and reopened mid-intermission, so earlier purchases
    // come from the cached offer rather than this component's own state.
    setSelectedIndices(offeredUpgrades.flatMap((u, i) => u.purchased ? [i] : []))
  }

  useEffect(() => {
    loadBackendUpgrades()
  }, [])

  const handleReroll = async () => {
    if (canAffordReroll) {
      const currentWave = GameManager.getState().wave

      // Call backend to reroll upgrades
      const result = await waveValidation.rerollUpgrades(currentWave)

      if (result) {
        EventBus.emit('upgrade-rerolled')

        // Update GameManager with the new wallet from backend
        if (result.fragments) {
          GameManager.updatePlayerStats({ fragments: result.fragments })
        }

        setSelectedIndices([])  // Reset selected indices for new roll
        setOptions([])  // Clear old options first

        // Load the new upgrades from the backend response
        const allUpgrades = getAllUpgrades().filter(u => !u.curse) as Upgrade[]

        // Backend returns full upgrade objects, map them to frontend upgrade objects
        const offeredUpgrades = result.upgrades
          .map((backendUpgrade: any) => {
            const upgrade = allUpgrades.find(u => u.id === backendUpgrade.id)
            return upgrade && { ...upgrade, discounted: backendUpgrade.discounted }
          })
          .filter(u => u !== undefined) as Upgrade[]

        setOptions(offeredUpgrades)
        console.log(`Rerolled to ${offeredUpgrades.length} new upgrades`)
      } else {
        console.error('Failed to reroll upgrades')
      }
    }
  }

  const handleUpgradeClick = (upgrade: Upgrade, index: number) => {
    // Check if can afford
    if (!planPayment(GameManager.getPlayerStats().fragments, getRollPrice(upgrade, upgrade.discounted === true, NormalDifficulty), autoConvert)) {
      return
    }

    // Try to apply the upgrade
    EventBus.emit('upgrade-selected', upgrade.id)

    // this.scene.sound.play('upgrade_purchase', { volume: 0.3 })

    // Add index to selected list (not ID, to allow buying same upgrade twice)
    setSelectedIndices([...selectedIndices, index])
  }

  const isUpgradeDisabled = (upgrade: Upgrade, _index: number): boolean => {
    // Can't afford
    if (!planPayment(GameManager.getPlayerStats().fragments, getRollPrice(upgrade, upgrade.discounted === true, NormalDifficulty), autoConvert)) {
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
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50" style={isMobile ? { padding: '0 env(safe-area-inset-right, 20px) 0 env(safe-area-inset-left, 20px)' } : undefined}>
      <h2 className={`font-bold text-polygon-primary ${isMobile ? 'text-lg mb-1' : 'text-3xl mb-4'}`}>
        SHOP
      </h2>

      <div className={`flex ${isMobile ? 'gap-1 mb-2' : 'gap-2 mb-6'}`}>
        {SHOP_TABS.map(({ id, label, shortLabel, comingSoon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            disabled={comingSoon}
            className={`border-b-2 font-bold transition-all disabled:cursor-not-allowed disabled:text-gray-600 disabled:border-transparent ${
              tab === id ? 'border-polygon-primary text-polygon-primary' : 'border-gray-700 text-gray-400 hover:text-white'
            } ${isMobile ? 'px-2 py-1 text-[10px]' : 'px-4 py-2 text-sm'}`}
          >
            {isMobile ? shortLabel : label}
            {comingSoon && <span className={`block font-normal ${isMobile ? 'text-[8px]' : 'text-xs'}`}>Coming soon</span>}
          </button>
        ))}
      </div>

      {tab === 'convert' && <ConvertPanel fragments={fragments} />}

      {/* Hidden rather than unmounted, so the cards stay put across tab switches. */}
      <div className={`${SHOP_PANEL_CLASS} ${isMobile ? 'gap-2 w-full' : 'gap-4'} ${tab === 'roll' ? '' : 'hidden'}`}>
      <div className={`flex ${isMobile ? 'gap-2 w-full' : 'gap-6'}`}>
        {options.map((upgrade, index) => {
          const isDisabled = isUpgradeDisabled(upgrade, index)
          const isPurchasedFromBackend = upgrade.purchased === true
          const isPurchasedThisSession = selectedIndices.includes(index)
          const isPurchased = isPurchasedFromBackend || isPurchasedThisSession
          const price = getRollPrice(upgrade, upgrade.discounted === true, NormalDifficulty)
          const conversions = planPayment(fragments, price, autoConvert)
          const canAfford = conversions !== null
          const coverableByConverting = !autoConvert && !canAfford && planAutoConversion(fragments, price) !== null
          const isDiscounted = price.amount < upgrade.cost

          return (
            <button
              key={`${upgrade.id}-${index}`}
              onClick={() => !isDisabled && !isPurchased && handleUpgradeClick(upgrade, index)}
              disabled={isDisabled || isPurchased}
              className={`relative rounded-lg border-2 ${rarityColors[upgrade.rarity]} ${
                isPurchased ? 'bg-green-900/50 border-green-500' : ''
              } ${
                !isDisabled && !isPurchased ? 'hover:scale-105 cursor-pointer' : 'opacity-50 cursor-not-allowed'
              } transition-all flex flex-col text-left ${isMobile ? 'flex-1 min-w-0 p-2' : 'w-64 p-6'}`}
            >
              {isDiscounted && !isPurchased && (
                <span className={`absolute -top-2 -right-2 rounded bg-polygon-warning text-black font-bold ${isMobile ? 'px-1 text-[9px]' : 'px-2 py-0.5 text-xs'}`}>
                  -{NormalDifficulty.rollDiscountPercent}%
                </span>
              )}
              <div className={`flex items-center gap-1 font-bold uppercase ${rarityTextColors[upgrade.rarity]} ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
                <GameIcon icon={upgrade.icon} fallback={IconID.Upgrade} className={isMobile ? 'text-sm' : 'text-2xl'} />
                {upgrade.rarity}
              </div>
              <h3 className={`font-bold text-white ${isMobile ? 'text-xs mt-1 mb-1' : 'text-xl mt-2 mb-2'}`}>
                {upgrade.name}
              </h3>
              <p className={`text-gray-400 flex-grow ${isMobile ? 'text-[10px] leading-tight' : 'text-sm'}`}>
                {upgrade.description}
              </p>
              {upgrade.specificAttackType && (
                <div className={`text-polygon-secondary text-[10px] ${isMobile ? 'mt-1' : 'mt-3'}`}>
                  {upgrade.specificAttackType.toUpperCase()}
                </div>
              )}
              <div className={`flex items-center gap-1 font-bold ${isMobile ? 'text-[10px] mt-1' : 'text-base mt-3'} ${
                isPurchased ? 'text-green-400' :
                canAfford && !isDisabled ? 'text-polygon-warning' : 'text-red-500'
              }`}>
                {isPurchased ? 'PURCHASED' : (
                  <>
                    {price.amount === 0 ? 'FREE' : (
                      <>
                        <FragmentIcon tier={price.tier} size={isMobile ? 10 : 16} />
                        {price.amount}
                        {isDiscounted && <span className="font-normal text-gray-500 line-through">{upgrade.cost}</span>}
                      </>
                    )}
                    {!canAfford ? ' (Can\'t Afford)' : isDisabled ? ' (Conflicts)' : ''}
                  </>
                )}
              </div>
              {!isPurchased && !isDisabled && conversions && conversions.length > 0 && (
                <div className={`flex flex-wrap items-center gap-1 text-gray-400 ${isMobile ? 'text-[9px]' : 'text-xs mt-1'}`}>
                  Converts
                  {conversions.map(({ from, cost }) => (
                    <span key={from} className="flex items-center gap-0.5 text-white">
                      <FragmentIcon tier={from} size={isMobile ? 9 : 12} />
                      {cost.toLocaleString()}
                    </span>
                  ))}
                </div>
              )}
              {!isPurchased && coverableByConverting && (
                <div className={`text-gray-500 ${isMobile ? 'text-[9px]' : 'text-xs mt-1'}`}>
                  Auto-convert could cover this
                </div>
              )}
            </button>
          )
        })}
      </div>

        <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-6'}`}>
          <button
            onClick={handleReroll}
            disabled={!canAffordReroll}
            className={`flex items-center gap-1 border border-gray-600 text-gray-400 rounded hover:border-polygon-warning hover:text-polygon-warning transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'px-3 py-1.5 text-xs' : 'px-6 py-2'}`}
          >
            REROLL (<FragmentIcon tier={REROLL_PRICE.tier} size={isMobile ? 10 : 14} />{REROLL_PRICE.amount})
          </button>
          <FragmentRow counts={fragments} size={isMobile ? 12 : 14} className={isMobile ? 'font-bold text-xs' : 'text-sm'} />
          <label className={`flex items-center gap-2 cursor-pointer select-none text-gray-300 hover:text-white ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
            <input
              type="checkbox"
              checked={autoConvert}
              onChange={e => toggleAutoConvert(e.target.checked)}
              className="accent-polygon-primary cursor-pointer"
            />
            Auto-convert fragments
          </label>
        </div>

        {selectedIndices.length > 0 && (
          <p className={`text-green-400 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
            {selectedIndices.length} upgrade{selectedIndices.length > 1 ? 's' : ''} purchased
          </p>
        )}
      </div>

      <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-4'}`}>
        <button
          onClick={onClose}
          className={`border border-gray-600 text-gray-400 rounded hover:border-white hover:text-white transition-all ${isMobile ? 'px-3 py-1.5 text-xs' : 'px-6 py-2'}`}
        >
          CLOSE
        </button>

        <button
          onClick={handleStartWave}
          className={`bg-polygon-primary text-black font-bold rounded hover:bg-green-400 transition-all ${isMobile ? 'px-5 py-1.5 text-sm' : 'px-8 py-3 text-lg'}`}
        >
          START WAVE
        </button>
      </div>
    </div>
  )
}
