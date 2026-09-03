import { useEffect, useState } from 'react'
import { PerfStats, PerfPeaks, resetPeaks, isPerfEnabled } from '../game/core/PerfStats'
import { SETTINGS } from '../game/core/SettingsStorage'

/**
 * On-screen performance readout.
 *
 * DELIBERATELY NOT IN DevTools: that component early-returns null on mobile
 * (DevTools.tsx), and mobile is exactly where this matters - a mid-range phone
 * runs this JS several times slower than a desktop, so it is the device that
 * decides how much lighting the game can afford.
 *
 * THREE MODES:
 *   off   - nothing rendered.
 *   basic - Settings > Show FPS. The player-facing readout: fps, enemies,
 *           projectiles. No ms timings, because they mean nothing to a player.
 *   full  - Settings > Show Diagnostics (nested under Show FPS), or ?perf=1.
 *           Adds the frame/lighting timings and the peak tracker.
 *
 * ?perf=1 STILL FORCES FULL. It works on a phone with no UI to tap, which is
 * the point - open the LAN dev URL with ?perf=1 and read the numbers, no menu
 * navigation required. The choice is remembered in localStorage, so ?perf=0
 * turns it back off - and so does touching either Settings toggle, otherwise a
 * ?perf=1 from weeks ago would quietly outrank them (see clearPerfFlag).
 *
 * The mode is resolved once at mount rather than polled: settings are only
 * reachable from the main menu, which unmounts the game, so a change always
 * takes effect on the next mount anyway.
 *
 * Polls at 5Hz rather than subscribing per-frame: PerfStats is written 60 times
 * a second, and re-rendering React at that rate would cost more than the systems
 * being measured.
 */

const POLL_MS = 200

/**
 * ============================================================================
 * SIZE KNOB - the only number to touch to make this bigger or smaller.
 * ============================================================================
 * Body text size in px. Everything else in the overlay - padding, corner
 * radius, row gap, both panel widths, the footer line - is derived from it
 * below, so the whole thing scales as one piece and no value can drift out of
 * proportion with the others. Tuned by eye on desktop; 10 was the first pass
 * and read as far too heavy over the HUD.
 */
const FONT_PX = 6

const PAD_Y = Math.round(FONT_PX * 0.5)
const PAD_X = Math.round(FONT_PX * 0.7)
const RADIUS = Math.round(FONT_PX * 0.5)
const ROW_GAP = FONT_PX
// const FOOTER_PX = FONT_PX - 1
/** Widths are in units of FONT_PX so the label/value columns never collide. */
const WIDTH_FULL = Math.round(FONT_PX * 18.6)
const WIDTH_BASIC = Math.round(FONT_PX * 10.4)

/** 60fps leaves this many ms for EVERYTHING - logic, rendering, browser work. */
const FRAME_BUDGET_MS = 1000 / 60

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

/**
 * Parked under the wave/points block on the right, NOT top-left where it used
 * to sit on top of the health bar. GameHUD scales itself 0.5 on mobile, so the
 * block it has to clear is half as tall there.
 */
const TOP_OFFSET = isMobile ? 66 : 120

/** Green under half the frame budget, amber approaching it, red over. */
function budgetColor(ms: number): string {
  const pct = ms / FRAME_BUDGET_MS
  if (pct < 0.5) return '#4ade80'
  if (pct < 0.8) return '#fbbf24'
  return '#f87171'
}

type Mode = 'off' | 'basic' | 'full'

function resolveMode(): Mode {
  if (isPerfEnabled()) return 'full'
  if (!SETTINGS.showFPS) return 'off'
  return SETTINGS.showDiagnostics ? 'full' : 'basic'
}

export default function PerfOverlay() {
  const [mode] = useState<Mode>(resolveMode)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (mode === 'off') return
    const id = setInterval(() => setTick(t => t + 1), POLL_MS)
    return () => clearInterval(id)
  }, [mode])

  if (mode === 'off') return null

  const full = mode === 'full'
  const { fps, updateMs, lightingMs, lightGroups, lights, lightsCulled, lightWindow, enemies, projectiles } =
    PerfStats
  const pct = (ms: number) => ((ms / FRAME_BUDGET_MS) * 100).toFixed(0)

  const row = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: ROW_GAP }}>
      <span style={{ opacity: 0.65 }}>{label}</span>
      <span style={{ color: color ?? '#e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )

  const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '4px 0' }} />

  return (
    <div
      onClick={full ? resetPeaks : undefined}
      style={{
        position: 'fixed',
        top: TOP_OFFSET,
        right: 8,
        zIndex: 9999,
        padding: `${PAD_Y}px ${PAD_X}px`,
        borderRadius: RADIUS,
        background: 'rgba(10,10,15,0.82)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#e5e7eb',
        font: `${FONT_PX}px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace`,
        minWidth: full ? WIDTH_FULL : WIDTH_BASIC,
        pointerEvents: full ? 'auto' : 'none',
        userSelect: 'none'
      }}
      title={full ? '' : undefined}
    >
      {row('fps', fps.toFixed(0), fps < 55 ? '#f87171' : fps < 58 ? '#fbbf24' : '#4ade80')}
      {full && (
        <>
          {row('update', `${updateMs.toFixed(2)}ms ${pct(updateMs)}%`, budgetColor(updateMs))}
          {row('└ lighting', `${lightingMs.toFixed(2)}ms ${pct(lightingMs)}%`, budgetColor(lightingMs))}
          {row('light groups', String(lightGroups), lightGroups > 3 ? '#fbbf24' : undefined)}
          {row('lights', `${lights} lit / ${lightsCulled} culled`)}
          {row('flood window', `${(lightWindow * 100).toFixed(0)}% of grid`, lightWindow > 0.75 ? '#fbbf24' : '#4ade80')}
          {divider}
          {row('peak update', `${PerfPeaks.updateMs.toFixed(2)}ms`, budgetColor(PerfPeaks.updateMs))}
          {row('peak lighting', `${PerfPeaks.lightingMs.toFixed(2)}ms`, budgetColor(PerfPeaks.lightingMs))}
          {row('peak groups', String(PerfPeaks.lightGroups))}
          {divider}
        </>
      )}
      {row('enemies', String(enemies))}
      {row('projectiles', String(projectiles))}
    </div>
  )
}
