import type { RarityID } from '../game/data/ID'
import { FRAGMENT_COLORS, FRAGMENT_TIERS, fragmentPolygon, type FragmentCounts } from '../game/systems/FragmentBudget'

export default function FragmentIcon({ tier, size = 14 }: { tier: RarityID; size?: number }) {
  // Radius leaves room for the stroke inside the 24-unit box.
  const points = fragmentPolygon(tier, 9.5, 12, 12).map(p => `${p.x},${p.y}`).join(' ')
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-label={`${tier} fragment`}>
      <polygon points={points} fill="none" stroke={FRAGMENT_COLORS[tier]} strokeWidth={4.0} strokeLinejoin="round" />
    </svg>
  )
}

/** All five tiers, always, so the layout doesn't jump as counts appear. */
export function FragmentRow({ counts, size = 14, className = '' }: { counts: FragmentCounts; size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2 tabular-nums ${className}`}>
      {FRAGMENT_TIERS.map(tier => (
        <div key={tier} className="flex items-center gap-1" style={{ color: FRAGMENT_COLORS[tier] }}>
          <FragmentIcon tier={tier} size={size} />
          <span>{counts[tier].toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}