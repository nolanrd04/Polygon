import { useEffect, useRef, useState } from 'react'
import { Game } from 'phaser'
import { gameConfig } from '../game/core/GameConfig'
import UpgradeModal from '../components/UpgradeModal'
import WaveComplete from '../components/WaveComplete'
import GameHUD from '../components/GameHUD'
import PauseMenu from '../components/PauseMenu'
import DevTools from '../components/DevTools'
import AbilityDisplay from '../components/AbilityDisplay'
import { EventBus } from '../game/core/EventBus'
import { GameManager } from '../game/core/GameManager'

export default function GamePage() {
  const gameRef = useRef<Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [showUpgrades, setShowUpgrades] = useState(false)
  const [showWaveComplete, setShowWaveComplete] = useState(false)
  const [waveData, setWaveData] = useState({ wave: 0, score: 0, isPrime: false })
  const [playerStats, setPlayerStats] = useState({ health: 100, maxHealth: 100, points: 0, kills: 0 })
  const [selectedAttack, setSelectedAttack] = useState('bullet')
  const [showCollisionBoxes, setShowCollisionBoxes] = useState(false)
  const [abilityState, setAbilityState] = useState({ shieldCharges: 0, hasDash: false, dashCooldownProgress: 1 })

  useEffect(() => {
    // Get selected attack from sessionStorage
    const attack = sessionStorage.getItem('selectedAttack') || 'bullet'
    setSelectedAttack(attack)

    if (containerRef.current && !gameRef.current) {
      gameRef.current = new Game({
        ...gameConfig,
        parent: containerRef.current
      })
    }

    // Listen for game events
    EventBus.on('wave-start', (wave: number) => {
      // Update wave number immediately when wave starts
      setWaveData(prev => ({ ...prev, wave }))
    })

    EventBus.on('wave-complete', (data) => {
      setWaveData(data)
      setShowWaveComplete(true)
    })

    EventBus.on('show-upgrades', () => {
      setShowUpgrades(true)
    })

    EventBus.on('player-stats-update', (stats) => {
      // console.log(`[GamePage] Stats update received - kills: ${stats.kills}`)
      setPlayerStats(stats)
    })

    EventBus.on('game-pause', () => setIsPaused(true))
    EventBus.on('game-resume', () => setIsPaused(false))

    // Listen for ability state updates
    EventBus.on('ability-state-update' as any, (state: { shieldCharges: number; hasDash: boolean; dashCooldownProgress: number }) => {
      setAbilityState(state)
    })

    // Poll for ability state (for dash cooldown which changes constantly)
    const abilityInterval = setInterval(() => {
      EventBus.emit('request-ability-state' as any)
    }, 100) // Update 10 times per second

    // Removed upgrade-applied listener - now handled by Start Wave button

    return () => {
      clearInterval(abilityInterval)
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
      EventBus.removeAllListeners()
    }
  }, [])

  const handleStartWave = () => {
    setShowUpgrades(false)
    EventBus.emit('start-next-wave')
  }

  const handleWaveCompleteContinue = () => {
    setShowWaveComplete(false)
    setShowUpgrades(true)
  }

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />

      <GameHUD
        health={playerStats.health}
        maxHealth={playerStats.maxHealth}
        points={playerStats.points}
        kills={playerStats.kills}
        wave={waveData.wave}
      />

      <AbilityDisplay
        shieldCharges={abilityState.shieldCharges}
        hasDash={abilityState.hasDash}
        dashCooldownProgress={abilityState.dashCooldownProgress}
      />

      {isPaused && (
        <PauseMenu
          onResume={() => GameManager.resume()}
          onQuit={() => window.location.href = '/'}
        />
      )}

      {showWaveComplete && (
        <WaveComplete
          wave={waveData.wave}
          score={waveData.score}
          isPrime={waveData.isPrime}
          onContinue={handleWaveCompleteContinue}
        />
      )}

      {showUpgrades && (
        <UpgradeModal
          onStartWave={handleStartWave}
          playerPoints={playerStats.points}
          selectedAttack={selectedAttack}
        />
      )}

      <DevTools
        onToggleCollisionBoxes={() => {
          setShowCollisionBoxes(!showCollisionBoxes)
          EventBus.emit('toggle-collision-boxes' as any, !showCollisionBoxes)
        }}
        showCollisionBoxes={showCollisionBoxes}
      />
    </div>
  )
}
