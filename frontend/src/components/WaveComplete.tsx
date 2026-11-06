import type { FragmentCounts } from '../game/systems/FragmentBudget'
import { FragmentRow } from './FragmentIcon'

interface WaveCompleteProps {
  wave: number
  bonus: FragmentCounts
  onContinue: () => void
}

export default function WaveComplete({ wave, bonus, onContinue }: WaveCompleteProps) {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-polygon-primary mb-2">
          WAVE {wave-1} COMPLETE
        </h2>

        <div className="my-8">
          <div className="text-gray-400 text-sm mb-2">WAVE BONUS</div>
          <FragmentRow counts={bonus} size={20} className="justify-center gap-4 text-2xl font-bold" />
        </div>

        {(wave) % 10 === 0 && (
          <div className="text-polygon-danger text-xl mb-4 animate-pulse">
            WARNING: BOSS INCOMING
          </div>
        )}

        <button
          onClick={onContinue}
          className="mt-4 px-12 py-4 bg-polygon-primary text-black font-bold text-xl rounded hover:bg-green-400 transition-all transform hover:scale-105"
        >
          CONTINUE
        </button>
      </div>
    </div>
  )
}
