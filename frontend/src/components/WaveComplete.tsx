interface WaveCompleteProps {
  wave: number
  score: number
  isPrime: boolean
  onContinue: () => void
}

export default function WaveComplete({ wave, score, isPrime, onContinue }: WaveCompleteProps) {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-polygon-primary mb-2">
          WAVE {wave} COMPLETE
        </h2>

        {isPrime && (
          <div className="text-polygon-warning text-lg mb-4 animate-pulse">
            PRIME WAVE BONUS - DOUBLE SCORE!
          </div>
        )}

        <div className="text-6xl font-bold text-white my-8">
          +{score.toLocaleString()}
          <span className="text-2xl text-polygon-warning ml-2">PTS</span>
        </div>

        {(wave + 1) % 10 === 0 && (
          <div className="text-polygon-danger text-xl mb-4 animate-pulse">
            WARNING: BOSS INCOMING
          </div>
        )}

        <button
          onClick={onContinue}
          className="mt-4 px-12 py-4 bg-polygon-primary text-black font-bold text-xl rounded hover:bg-green-400 transition-all transform hover:scale-105"
        >
          SELECT UPGRADES
        </button>
      </div>
    </div>
  )
}
