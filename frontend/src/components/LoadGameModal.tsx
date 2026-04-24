import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { applyLocalSave, importLocalSave } from '../game/services/LocalSaveManager'

interface LoadGameModalProps {
  onClose: () => void
}

export default function LoadGameModal({ onClose }: LoadGameModalProps) {
  const navigate = useNavigate()
  const [pastedText, setPastedText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleLoad = () => {
    setError(null)
    const parsed = importLocalSave(pastedText)
    if (!parsed) {
      setError('Could not read that save. Make sure you pasted the complete text.')
      return
    }

    applyLocalSave(parsed)

    // Signal to GamePage that state has already been restored in memory
    // and the HUD should sync from the current GameManager state.
    sessionStorage.setItem('loadLocalSave', 'true')
    sessionStorage.setItem('selectedAttack', 'bullet')

    navigate('/game')
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[110] p-4">
      <div className="bg-polygon-darker border-2 border-polygon-secondary rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-2xl font-bold text-polygon-secondary mb-2">LOAD FROM SAVE</h2>
        <p className="text-gray-500 text-xs mb-2">
          Paste your saved game text below.
        </p>

        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Paste your save here..."
          className="w-full h-48 bg-black text-green-300 font-mono text-xs p-3 rounded border border-gray-700 resize-none"
        />

        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleLoad}
            disabled={pastedText.trim().length === 0}
            className="flex-1 px-6 py-3 bg-polygon-secondary text-black font-bold rounded hover:bg-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            LOAD
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-500 text-gray-300 font-semibold rounded hover:border-gray-300 hover:text-white transition-all"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}