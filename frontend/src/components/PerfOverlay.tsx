import { useEffect, useState } from 'react'
import { PerfStats, PerfPeaks, resetPeaks, isPerfEnabled } from '../game/core/PerfStats'

/**
 * On-screen performance readout.
 *
 * DELIBERATELY NOT IN DevTools: that component early-returns null on mobile
 * (DevTools.tsx), and mobile is exactly where this matters - a mid-range phone
 * runs this JS several times slower than a desktop, so it is the device that
 * decides how much lighting the game can afford.
 *
 * ENABLE IT: add ?perf=1 to the URL. That works on a phone with no UI to tap,
 * which is the point - open the LAN dev URL with ?perf=1 and read the numbers.
 * The choice is remembered in localStorage, so ?perf=0 turns it back off.
 *
 * Polls at 5Hz rather than subscribing per-frame: PerfStats is written 60 times
 * a second, and re-rendering React at that rate would cost more than the systems
 * being measured.
 */

const POLL_MS = 200

/** 60fps leaves this many ms for EVERYTHING - logic, rendering, browser work. */
const FRAME_BUDGET_MS = 1000 / 60

/** Green under half the frame budget, amber approaching it, red over. */
function budgetColor(ms: number): string {
  const pct = ms / FRAME_BUDGET_MS
  if (pct < 0.5) return '#4ade80'
  if (pct < 0.8) return '#fbbf24'
  return '#f87171'
}

export default function PerfOverlay() {
  const [enabled] = useState(isPerfEnabled)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setTick(t => t + 1), POLL_MS)
    return () => clearInterval(id)
  }, [enabled])

  if (!enabled) return null

  const { fps, updateMs, lightingMs, lightGroups, enemies, projectiles } = PerfStats
  const pct = (ms: number) => ((ms / FRAME_BUDGET_MS) * 100).toFixed(0)

  const row = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ opacity: 0.65 }}>{label}</span>
      <span style={{ color: color ?? '#e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )

  return (
    <div
      onClick={resetPeaks}
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 9999,
        padding: '8px 10px',
        borderRadius: 6,
        background: 'rgba(10,10,15,0.82)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#e5e7eb',
        font: '11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
        minWidth: 172,
        pointerEvents: 'auto',
        userSelect: 'none'
      }}
      title="Tap to reset peaks"
    >
      {row('fps', fps.toFixed(0), fps < 55 ? '#f87171' : fps < 58 ? '#fbbf24' : '#4ade80')}
      {row('update', `${updateMs.toFixed(2)}ms ${pct(updateMs)}%`, budgetColor(updateMs))}
      {row('└ lighting', `${lightingMs.toFixed(2)}ms ${pct(lightingMs)}%`, budgetColor(lightingMs))}
      {row('light groups', String(lightGroups), lightGroups > 3 ? '#fbbf24' : undefined)}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '5px 0' }} />
      {row('peak update', `${PerfPeaks.updateMs.toFixed(2)}ms`, budgetColor(PerfPeaks.updateMs))}
      {row('peak lighting', `${PerfPeaks.lightingMs.toFixed(2)}ms`, budgetColor(PerfPeaks.lightingMs))}
      {row('peak groups', String(PerfPeaks.lightGroups))}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '5px 0' }} />
      {row('enemies', String(enemies))}
      {row('projectiles', String(projectiles))}
      <div style={{ marginTop: 5, opacity: 0.4, fontSize: 10 }}>
        budget {FRAME_BUDGET_MS.toFixed(1)}ms · tap to reset
      </div>
    </div>
  )
}
