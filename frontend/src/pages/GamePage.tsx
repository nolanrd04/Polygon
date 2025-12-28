import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Game } from 'phaser'
import { gameConfig } from '../game/core/GameConfig'
import UpgradeModal from '../components/UpgradeModal'
import WaveComplete from '../components/WaveComplete'
import GameHUD from '../components/GameHUD'
import PauseMenu from '../components/PauseMenu'
import DevTools from '../components/DevTools'
import AbilityDisplay from '../components/AbilityDisplay'
import { EventBus } from '../game/core/EventBus'
import { SaveManager } from '../game/services/SaveManager'
import { GameManager } from '../game/core/GameManager'

export default function GamePage() {
  const navigate = useNavigate()
  const gameRef = useRef<Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [showUpgrades, setShowUpgrades] = useState(false)
  const [showWaveComplete, setShowWaveComplete] = useState(false)
  const [waveData, setWaveData] = useState({ wave: 1, score: 0, isPrime: false })
  const [playerStats, setPlayerStats] = useState({ health: 100, maxHealth: 100, points: 0, kills: 0 })
  const [selectedAttack, setSelectedAttack] = useState('bullet')
  const [showCollisionBoxes, setShowCollisionBoxes] = useState(false)
  const [abilityState, setAbilityState] = useState({ shieldCharges: 0, hasDash: false, dashCooldownProgress: 1 })
  const [loadError, setLoadError] = useState<string | null>(null)

  // Store last known game state in ref to survive game destruction
  const lastGameStateRef = useRef<any>(null)
  // Track if death save has been completed to prevent overwriting it
  const deathSaveCompletedRef = useRef(false)

  useEffect(() => {
    const initGame = async () => {
      // Check if we're playing offline (sandbox mode)
      const playOffline = sessionStorage.getItem('playOffline')

      if (playOffline === 'true') {
        console.log('[OFFLINE] Starting game in sandbox mode')
        // Set the player as dead immediately to start in sandbox mode
        const initialState = GameManager.getState()
        GameManager.updatePlayerStats({
          ...initialState.playerStats,
          isDead: true
        })

        // Clear the flag
        sessionStorage.removeItem('playOffline')
      }

      // Check if we're loading a saved game
      const loadSavedGame = sessionStorage.getItem('loadSavedGame')

      if (loadSavedGame === 'true') {
        // Load saved game state using SaveManager
        const savedData = await SaveManager.loadFullGame()

        // If we tried to load but failed (returns null), it means the save was invalid/game_over
        if (!savedData) {
          console.log('[LOAD] Failed to load save - save is marked as game over or invalid')
          setLoadError('This save has ended. Starting a new game...')
          // Redirect to main menu after a short delay so user can see the message
          setTimeout(() => {
            navigate('/')
          }, 1500)
          sessionStorage.removeItem('loadSavedGame')
          return
        }

        // Restore game state before creating the game
        SaveManager.restoreGameState(savedData)
        console.log('Loaded saved game from wave', savedData.gameStats.currentWave)

        // Update HUD to show the loaded wave immediately (don't wait for wave-start event)
        setWaveData(prev => ({ ...prev, wave: savedData.gameStats.currentWave }))

        // Update player stats HUD to show loaded values immediately
        setPlayerStats({
          health: savedData.playerState.currentHealth,
          maxHealth: savedData.playerState.currentMaxHealth,
          points: savedData.points.currentPoints,
          kills: savedData.gameStats.currentKills
        })

        // Initialize ref with restored state
        lastGameStateRef.current = GameManager.getState()

        // Clear the flag
        sessionStorage.removeItem('loadSavedGame')
      }

      // Get selected attack from sessionStorage
      const attack = sessionStorage.getItem('selectedAttack') || 'bullet'
      setSelectedAttack(attack)

      if (containerRef.current && !gameRef.current) {
        gameRef.current = new Game({
          ...gameConfig,
          parent: containerRef.current
        })
      }

      // Initialize ref with initial game state after game is created
      // Use setTimeout to ensure game has fully initialized
      setTimeout(() => {
        if (!lastGameStateRef.current) {
          const initialState = GameManager.getState()
          if (initialState && initialState.wave && initialState.wave > 0) {
            lastGameStateRef.current = initialState
            console.log('Initialized ref with initial game state, wave:', initialState.wave, 'points:', initialState.playerStats.points)
          }
        }
      }, 100)
    }

    initGame()

    // Listen for game events
    EventBus.on('wave-start', (wave: number) => {
      // Update wave number immediately when wave starts
      setWaveData(prev => ({ ...prev, wave }))
      // Update ref with latest game state
      lastGameStateRef.current = GameManager.getState()
    })

    EventBus.on('wave-complete', (data) => {
      setWaveData(data)
      setShowWaveComplete(true)
      // Update ref with latest game state
      lastGameStateRef.current = GameManager.getState()
    })

    EventBus.on('show-upgrades', () => {
      setShowUpgrades(true)
    })

    EventBus.on('player-stats-update', (stats) => {
      // console.log(`[GamePage] Stats update received - kills: ${stats.kills}`)
      setPlayerStats(stats)
      // Update ref with latest game state to survive component destruction
      lastGameStateRef.current = GameManager.getState()
    })

    EventBus.on('game-pause', () => setIsPaused(true))
    EventBus.on('game-resume', () => setIsPaused(false))

    // Save on player death using modular SaveManager
    EventBus.on('player-death', () => {
      // Only save once on death (event fires every frame while dead)
      if (deathSaveCompletedRef.current) {
        return
      }

      console.log('[DEATH] Event triggered - Using SaveManager.saveOnDeath()')
      const state = GameManager.getState()
      console.log('[DEATH] Current state:', { wave: state.wave, points: state.playerStats.points, kills: state.playerStats.kills })

      // Use modular SaveManager for death save
      // This saves: DeathState (frozen) + Points (current) + Upgrades (ordered)
      SaveManager.saveOnDeath().then(results => {
        const allSuccessful = results.every(r => r.success)
        console.log('[DEATH] SaveManager results:', results.map(r => `${r.category}:${r.success}`).join(', '))
        if (allSuccessful || results.length > 0) {
          deathSaveCompletedRef.current = true
          console.log('[DEATH] Death save completed - game stats saves now blocked')
        }
      })

    })

    // Listen for ability state updates
    EventBus.on('ability-state-update' as any, (state: { shieldCharges: number; hasDash: boolean; dashCooldownProgress: number }) => {
      setAbilityState(state)
    })

    // Poll for ability state (for dash cooldown which changes constantly)
    const abilityInterval = setInterval(() => {
      EventBus.emit('request-ability-state' as any)
    }, 100) // Update 10 times per second

    // Removed upgrade-applied listener - now handled by Start Wave button

    // Add ESC key handler for pause/resume (DOM level, works even when scene is paused)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const state = GameManager.getState()
        if (state.isPaused) {
          GameManager.resume()
        } else {
          GameManager.pause()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    // Add beforeunload handler to save on tab close
    const handleBeforeUnload = () => {
      // Use SaveManager for quit save (handles death state internally)
      // Note: This is fire-and-forget since we can't await in beforeunload
      SaveManager.saveOnQuit()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(abilityInterval)

      // Use SaveManager for quit save (handles death state internally)
      console.log('[UNMOUNT] Using SaveManager.saveOnQuit()')
      SaveManager.saveOnQuit()

      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
      EventBus.removeAllListeners()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('beforeunload', handleBeforeUnload)
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
      {loadError && (
        <div className="fixed inset-0 bg-polygon-darker/95 flex flex-col items-center justify-center z-50">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-red-500">INVALID SAVE</h2>
            <p className="text-lg text-gray-300">{loadError}</p>
            <div className="mt-8 animate-pulse">
              <p className="text-sm text-gray-400">Returning to menu...</p>
            </div>
          </div>
        </div>
      )}
      
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
          onQuit={async () => {
            // Use SaveManager for quit save (handles death state internally)
            console.log('[QUIT] Using SaveManager.saveOnQuit()')
            await SaveManager.saveOnQuit()
            window.location.href = '/'
          }}
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
