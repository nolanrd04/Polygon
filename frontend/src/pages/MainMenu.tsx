import { useNavigate } from 'react-router-dom'

export default function MainMenu() {
  const navigate = useNavigate()

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-polygon-darker">
      <h1 className="text-6xl font-bold text-polygon-primary mb-4 tracking-wider">
        POLYGON
      </h1>
      <p className="text-gray-400 mb-12 text-lg">Survive. Evolve. Dominate.</p>

      <div className="flex flex-col gap-4 w-64">
        <button
          onClick={() => navigate('/select-attack')}
          className="px-8 py-4 bg-polygon-primary text-black font-bold text-xl rounded hover:bg-green-400 transition-all transform hover:scale-105"
        >
          PLAY
        </button>

        <button
          onClick={() => navigate('/login')}
          className="px-8 py-3 border-2 border-polygon-secondary text-polygon-secondary font-semibold rounded hover:bg-polygon-secondary hover:text-black transition-all"
        >
          LOGIN
        </button>

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
