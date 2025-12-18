import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'

export default function MainMenu() {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hasSavedGame, setHasSavedGame] = useState(false)
  const [savedGameWave, setSavedGameWave] = useState(0)

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
      const response = await axios.get('/api/saves/', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data) {
        setHasSavedGame(true)
        setSavedGameWave(response.data.current_wave)
      }
    } catch (error) {
      console.error('Failed to check for saved game:', error)
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

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-polygon-darker">
      <h1 className="text-6xl font-bold text-polygon-primary mb-4 tracking-wider">
        POLYGON
      </h1>
      <p className="text-gray-400 mb-12 text-lg">Survive. Evolve. Dominate.</p>

      <div className="flex flex-col gap-4 w-64">
        {/* Show Continue Game if logged in and has save */}
        {isLoggedIn && hasSavedGame && (
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

        {/* Only show LOGIN button if NOT logged in */}
        {!isLoggedIn && (
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 border-2 border-polygon-secondary text-polygon-secondary font-semibold rounded hover:bg-polygon-secondary hover:text-black transition-all"
          >
            LOGIN
          </button>
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
