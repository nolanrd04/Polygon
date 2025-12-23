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
import { SaveGameService } from '../game/services/SaveGameService'
import { GameManager } from '../game/core/GameManager'
import axios from 'axios'

export default function GamePage() {
  const navigate = useNavigate()
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
  const [loadError, setLoadError] = useState<string | null>(null)

  // Store last known game state in ref to survive game destruction
  const lastGameStateRef = useRef<any>(null)
  // Track if death save has been completed to prevent overwriting it
  const deathSaveCompletedRef = useRef(false)

  // Autosave current game state to backend
  const saveCurrentGameState = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      // Use ref state if available (survives game destruction), otherwise get from GameManager
      const gameState = lastGameStateRef.current || GameManager.getState()

      // Don't save if we have no valid state at all
      if (!gameState || !gameState.playerStats) {
        console.log('Skipping autosave - no valid game state')
        return
      }

      const stats = gameState.playerStats

      // Don't save if game hasn't been initialized yet (prevents saving 0 points on mount)
      // Backend requires wave >= 1, so never save wave 0
      if (!gameState.wave || gameState.wave === 0) {
        console.log('Skipping autosave - game not initialized yet (wave:', gameState.wave, ')')
        return
      }

      // Don't save if both ref is empty AND points are 0 (likely a mount/unmount cycle)
      if (!lastGameStateRef.current && stats.points === 0) {
        console.log('Skipping autosave - no ref and 0 points (likely initial mount)')
        return
      }

      console.log('Autosaving game state with points:', stats.points, '(from ref:', !!lastGameStateRef.current, ')')
      console.log('→ Sending to backend: wave =', gameState.wave, ', points =', stats.points)

      // Save current game state to backend
      await axios.post('/api/saves/', {
        current_wave: gameState.wave,
        current_points: stats.points,
        seed: gameState.seed,
        current_health: stats.health,
        current_max_health: stats.maxHealth,
        current_speed: stats.speed,
        current_polygon_sides: stats.polygonSides,
        current_kills: 0, // Accumulated kills tracked on wave completion
        current_damage_dealt: 0, // Accumulated damage tracked on wave completion
        current_upgrades: gameState.appliedUpgrades,
        offered_upgrades: [], // Will be populated when starting next wave
        attack_stats: {
          bullet: {
            damage: 10,
            speed: 400,
            cooldown: 200,
            size: 1,
            pierce: 0
          }
        },
        unlocked_attacks: stats.unlockedAttacks || ['bullet']
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      console.log('Game state auto-saved successfully')
    } catch (error) {
      console.error('Failed to autosave game state:', error)
    }
  }

  useEffect(() => {
    const initGame = async () => {
      // Check if we're loading a saved game
      const loadSavedGame = sessionStorage.getItem('loadSavedGame')

      if (loadSavedGame === 'true') {
        // Load saved game state
        const savedData = await SaveGameService.loadSavedGame()
        
        // If we tried to load but failed (returns null), it means the save was invalid/game_over
        if (loadSavedGame === 'true' && !savedData) {
          console.log('[LOAD] Failed to load save - save is marked as game over or invalid')
          setLoadError('This save has ended. Starting a new game...')
          // Redirect to main menu after a short delay so user can see the message
          setTimeout(() => {
            navigate('/')
          }, 1500)
          sessionStorage.removeItem('loadSavedGame')
          return
        }
        
        if (savedData) {
          // Check if the loaded save is marked as game over (prevents multi-tab exploit)
          if (savedData.game_over) {
            console.log('[LOAD] Save is marked as GAME OVER - cannot continue this run')
            setLoadError('This save has ended. Starting a new game...')
            // Redirect to main menu after a short delay so user can see the message
            setTimeout(() => {
              navigate('/')
            }, 1500)
            sessionStorage.removeItem('loadSavedGame')
            return
          }
          
          // Restore game state before creating the game
          SaveGameService.restoreGameState(savedData)
          console.log('Loaded saved game from wave', savedData.wave)
          // Initialize ref with restored state
          lastGameStateRef.current = GameManager.getState()
        }
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

    // Save on player death (allows mid-wave save for death, marks as game over)
    EventBus.on('player-death', () => {
      // Only save once on death (event fires every frame while dead)
      if (deathSaveCompletedRef.current) {
        return
      }

      console.log('[DEATH] Event triggered - Saving final state as GAME OVER')
      const state = GameManager.getState()
      console.log('[DEATH] Current state:', { wave: state.wave, points: state.playerStats.points, kills: state.playerStats.kills })
      SaveGameService.saveCurrentGameState(true, true).then(success => {
        console.log('[DEATH] Save result:', success ? 'SUCCESS' : 'FAILED')
        if (success) {
          deathSaveCompletedRef.current = true
          console.log('[DEATH] Death save completed - all future saves blocked')
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

    // Add beforeunload handler to save on tab close
    const handleBeforeUnload = () => {
      // Don't save if death save already completed (prevents overwriting game_over flag)
      if (!deathSaveCompletedRef.current) {
        saveCurrentGameState()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(abilityInterval)

      // Don't save if death save already completed (prevents overwriting game_over flag)
      if (!deathSaveCompletedRef.current) {
        console.log('[UNMOUNT] Saving game state')
        saveCurrentGameState()
      } else {
        console.log('[UNMOUNT] Skipping save - death save already completed')
      }

      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
      EventBus.removeAllListeners()
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
          onResume={() => EventBus.emit('game-resume')}
          onQuit={async () => {
            // Don't save if death save already completed (prevents overwriting game_over flag)
            if (!deathSaveCompletedRef.current) {
              await saveCurrentGameState()
            } else {
              console.log('[QUIT] Skipping save - death save already completed')
            }
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
