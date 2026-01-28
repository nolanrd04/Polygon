interface AbilityDisplayProps {
  shieldCharges: number
  hasDash: boolean
  dashCooldownProgress: number
  maxDashCharges: number
  dashQueueProgress: number
  readyDashCharges: number
}

export default function AbilityDisplay({ shieldCharges, hasDash, dashCooldownProgress, maxDashCharges = 1, dashQueueProgress = 1, readyDashCharges = 0 }: AbilityDisplayProps) {
  // Don't render if no abilities are active
  if (shieldCharges === 0 && !hasDash) return null

  const dashReady = dashCooldownProgress >= 1

  return (
    <div className="absolute top-24 left-4 pointer-events-none">
      <div className="flex flex-col gap-2">
        {/* Shield Ability */}
        {shieldCharges > 0 && (
          <div className="bg-gray-900/80 border border-cyan-500/50 rounded-lg p-2 min-w-[160px]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-cyan-500/20 rounded flex items-center justify-center border border-cyan-500">
                <span className="text-cyan-400 font-bold text-sm">E</span>
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-400">SHIELD</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: shieldCharges }).map((_, i) => (
                    <div key={i} className="w-3 h-3 bg-cyan-500 rounded-sm" />
                  ))}
                </div>
              </div>
              <div className="text-cyan-400 font-bold text-lg">
                {shieldCharges}
              </div>
            </div>
          </div>
        )}

        {/* Dash Ability */}
        {hasDash && (
          <div className={`bg-gray-900/80 border rounded-lg p-2 min-w-[160px] ${
            readyDashCharges === maxDashCharges ? 'border-green-500/50' : 'border-blue-500/50'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded flex items-center justify-center border ${
                readyDashCharges === maxDashCharges
                  ? 'bg-green-500/20 border-green-500'
                  : 'bg-blue-500/20 border-blue-500'
              }`}>
                <span className={`font-bold text-xs ${
                  readyDashCharges === maxDashCharges ? 'text-green-400' : 'text-blue-400'
                }`}>
                  SPC
                </span>
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-400">DASH</div>
                {/* Single progress bar that fills as charges recharge */}
                <div className="relative w-full h-2 bg-gray-800 rounded-full overflow-hidden mt-0.5 border border-gray-700">
                  {/* Fill bar - shows progress until all charges are ready */}
                  <div
                    className={`h-full transition-all duration-100 ${
                      readyDashCharges === maxDashCharges
                        ? 'bg-gradient-to-r from-green-600 to-green-400'
                        : 'bg-gradient-to-r from-blue-600 to-blue-400'
                    }`}
                    style={{ width: `${dashQueueProgress * 100}%` }}
                  />
                </div>
              </div>
              <div className={`text-xs font-bold whitespace-nowrap min-w-[24px] text-center ${
                readyDashCharges === maxDashCharges ? 'text-green-400' : 'text-blue-400'
              }`}>
                x{readyDashCharges}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
