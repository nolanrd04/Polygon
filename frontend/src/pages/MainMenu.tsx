import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from '../config/axios'

export default function MainMenu() {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hasSavedGame, setHasSavedGame] = useState(false)
  const [savedGameWave, setSavedGameWave] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)
  const [finalStats, setFinalStats] = useState({ wave: 0, points: 0, kills: 0 })

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token')
    setIsLoggedIn(!!token)

    // If logged in, check for saved game
    if (token) {
      checkForSavedGame(token)
    }
  }, [])

  const checkForSavedGame = async (token: string) => {
    try {
      const response = await axios.get('/api/saves/full', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data) {
        setHasSavedGame(true)
        setSavedGameWave(response.data.game_stats.current_wave)

        // Check if save is marked as game over (death_state exists or can_continue is false)
        const isGameOverState = !response.data.can_continue || response.data.death_state !== null
        console.log('[MAIN MENU] Checking game over state:', isGameOverState)
        if (isGameOverState) {
          console.log('[MAIN MENU] GAME OVER DETECTED - Hiding continue button')
          setIsGameOver(true)
          // Use death_state values when available (captures exact moment of death)
          // Fall back to game_stats for backward compatibility
          const deathState = response.data.death_state
          setFinalStats({
            wave: deathState?.waves_completed ?? response.data.game_stats.current_wave,
            points: deathState?.points_at_death ?? response.data.points.current_points,
            kills: deathState?.enemies_killed ?? response.data.game_stats.current_kills ?? 0
          })
          console.log('[MAIN MENU] Run ended - Wave:', deathState?.waves_completed, 'Points:', deathState?.points_at_death, 'Kills:', deathState?.enemies_killed)
        } else {
          console.log('[MAIN MENU] Game is active - showing continue button')
        }
      }
    } catch (error: any) {
      // 404 means no save exists, which is expected for new users
      if (error.response?.status === 404) {
        console.log('[MAIN MENU] No saved game found')
      } else {
        console.error('Failed to check for saved game:', error)
      }
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsLoggedIn(false)
    setHasSavedGame(false)
    window.location.reload()
  }

  const handleContinueGame = async () => {
    // Mark that we're loading a saved game
    sessionStorage.setItem('loadSavedGame', 'true')

    // Navigate to game (GamePage will load the saved state)
    navigate('/game')
  }

  const handlePlayOffline = () => {
    // Mark that we're playing offline (sandbox mode from the start)
    // Auto-select bullet attack and start game directly
    sessionStorage.setItem('playOffline', 'true')
    sessionStorage.setItem('selectedAttack', 'bullet')

    // Navigate directly to game, skipping attack selection
    navigate('/game')
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-polygon-darker">
      <h1 className="text-6xl font-bold text-polygon-primary mb-4 tracking-wider">
        POLYGON
      </h1>
      <p className="text-gray-400 mb-12 text-lg">Survive. Evolve. Dominate.</p>

      <div className="flex flex-col gap-4 w-64">
        {/* Show final stats if game is over */}
        {isLoggedIn && hasSavedGame && isGameOver && (
          <div className="px-8 py-6 bg-red-900/30 border-2 border-red-500 rounded mb-2">
            <h2 className="text-xl font-bold text-red-400 mb-2">RUN ENDED</h2>
            <div className="text-gray-300 text-sm space-y-1">
              <p>Wave Reached: <span className="text-white font-bold">{finalStats.wave}</span></p>
              <p>Final Points: <span className="text-white font-bold">{finalStats.points}</span></p>
              <p>Total Kills: <span className="text-white font-bold">{finalStats.kills}</span></p>
            </div>
          </div>
        )}

        {/* Show Continue Game if logged in and has save (only if not game over) */}
        {isLoggedIn && hasSavedGame && !isGameOver && (
          <button
            onClick={handleContinueGame}
            className="px-8 py-4 bg-polygon-warning text-black font-bold text-xl rounded hover:bg-yellow-400 transition-all transform hover:scale-105"
          >
            CONTINUE GAME
            <span className="block text-sm font-normal mt-1">Wave {savedGameWave}</span>
          </button>
        )}

        <button
          onClick={async () => {
            // If user has a saved game, delete it (starting fresh)
            if (hasSavedGame && isLoggedIn) {
              const token = localStorage.getItem('token')
              try {
                await axios.delete('/api/saves/', {
                  headers: { Authorization: `Bearer ${token}` }
                })
                console.log('Previous save deleted - starting new game')
              } catch (error) {
                console.error('Failed to delete save:', error)
              }
            }
            navigate('/select-attack')
          }}
          className="px-8 py-4 bg-polygon-primary text-black font-bold text-xl rounded hover:bg-green-400 transition-all transform hover:scale-105"
        >
          {hasSavedGame ? 'NEW GAME' : 'PLAY'}
        </button>

        {/* Only show PLAY OFFLINE and LOGIN buttons if NOT logged in */}
        {!isLoggedIn && (
          <>
            <button
              onClick={handlePlayOffline}
              className="px-8 py-3 border-2 border-polygon-secondary text-polygon-secondary font-semibold rounded hover:bg-polygon-secondary hover:text-black transition-all"
            >
              PLAY OFFLINE
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-3 border-2 border-gray-500 text-gray-400 font-semibold rounded hover:border-gray-300 hover:text-white transition-all text-sm"
            >
              LOGIN
            </button>
          </>
        )}

        {/* Show LOGOUT button if logged in */}
        {isLoggedIn && (
          <button
            onClick={handleLogout}
            className="px-8 py-3 border-2 border-polygon-danger text-polygon-danger font-semibold rounded hover:bg-polygon-danger hover:text-black transition-all"
          >
            LOGOUT
          </button>
        )}

        <button
          onClick={() => navigate('/settings')}
          className="px-8 py-3 border-2 border-gray-600 text-gray-400 font-semibold rounded hover:border-gray-400 hover:text-white transition-all"
        >
          SETTINGS
        </button>
      </div>

      <div className="absolute bottom-8 text-gray-600 text-sm">
        v0.1.0 - Early Development
      </div>
    </div>
  )
}
