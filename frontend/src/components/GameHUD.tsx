interface GameHUDProps {
  health: number
  maxHealth: number
  points: number
  wave: number
}

export default function GameHUD({ health, maxHealth, points, wave }: GameHUDProps) {
  const healthPercent = (health / maxHealth) * 100

  return (
    <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
      <div className="flex justify-between items-start">
        {/* Health Bar */}
        <div className="flex flex-col gap-1">
          <div className="text-sm text-gray-400">HEALTH</div>
          <div className="w-48 h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
              style={{ width: `${healthPercent}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">{health} / {maxHealth}</div>
        </div>

        {/* Wave & Points */}
        <div className="flex flex-col items-end gap-1">
          <div className="text-polygon-primary text-2xl font-bold">
            WAVE {wave}
          </div>
          <div className="text-polygon-warning text-lg">
            {points.toLocaleString()} PTS
          </div>
        </div>
      </div>
    </div>
  )
}
