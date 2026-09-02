/**
 * ============================================================================
 * PerfStats - per-frame timing, written by the game, read by the HUD
 * ============================================================================
 *
 * A plain mutable module object rather than React state or an EventBus message,
 * because it is written every single frame. Anything that triggers a React
 * render at 60Hz would cost more than the systems it is trying to measure.
 * PerfOverlay polls this a few times a second instead.
 *
 * WHY frameMs AND NOT just FPS:
 * Phaser's actualFps is vsync-locked, so it reads ~60 right up until the moment
 * work overruns the frame, then falls off a cliff to 30. It tells you that you
 * ALREADY broke the budget, never how close you are. `updateMs` is the wall time
 * MainScene.update() actually spent, so it shows headroom while you still have
 * some: at 60fps the whole frame is 16.67ms, shared with rendering and browser work.
 */
export const PerfStats = {
  /** Phaser's smoothed frame rate. Below ~58 sustained means frames are dropping. */
  fps: 0,
  /** Wall time MainScene.update() spent this frame, in ms. The headroom number. */
  updateMs: 0,
  /** Of that, how long LightingSystem.UpdateAll() took. */
  lightingMs: 0,
  /** Flood groups the light map ran - see LightingSystem.GroupCount. */
  lightGroups: 0,
  /** Lights that survived viewport culling and were actually flooded. */
  lights: 0,
  /** Lights dropped for being off-screen. Zero here means culling did nothing. */
  lightsCulled: 0,
  /**
   * Fraction of the light grid the flood swept, 0-1. This multiplies the cost of
   * every group, so it is the other half of the lighting budget: 6 groups over a
   * third of the grid costs what 2 groups over all of it does.
   */
  lightWindow: 1,
  /** Live enemies, for correlating cost spikes with what is on screen. */
  enemies: 0,
  /** Live player projectiles. */
  projectiles: 0
}

/**
 * Rolling maxima, so a spike that lasts three frames is still visible on a HUD
 * polled at 5Hz. Reset by the overlay when you tap it.
 */
export const PerfPeaks = {
  updateMs: 0,
  lightingMs: 0,
  lightGroups: 0
}

/** Fold this frame's samples into the peak tracker. Called once per frame. */
export function recordPeaks(): void {
  if (PerfStats.updateMs > PerfPeaks.updateMs) PerfPeaks.updateMs = PerfStats.updateMs
  if (PerfStats.lightingMs > PerfPeaks.lightingMs) PerfPeaks.lightingMs = PerfStats.lightingMs
  if (PerfStats.lightGroups > PerfPeaks.lightGroups) PerfPeaks.lightGroups = PerfStats.lightGroups
}

export function resetPeaks(): void {
  PerfPeaks.updateMs = 0
  PerfPeaks.lightingMs = 0
  PerfPeaks.lightGroups = 0
}

const PERF_FLAG_KEY = 'polygon.perf'

/**
 * Resolve ?perf=1 / ?perf=0 into a persisted flag.
 *
 * MUST run at app boot, not inside PerfOverlay. The overlay only mounts on
 * GamePage, but the URL is typed at the menu, and MainMenu navigates with
 * `navigate('/game')` - no query string - so by the time the overlay exists the
 * flag is long gone. Resolving it once at startup and persisting it is what
 * makes `/?perf=1` work from the menu, which is the only practical way to turn
 * this on with a phone.
 */
export function initPerfFlag(): void {
  try {
    const param = new URLSearchParams(window.location.search).get('perf')
    if (param === '1') localStorage.setItem(PERF_FLAG_KEY, '1')
    else if (param === '0') localStorage.removeItem(PERF_FLAG_KEY)
  } catch {
    // Private browsing can throw on localStorage; isPerfEnabled falls back to the URL.
  }
}

export function isPerfEnabled(): boolean {
  try {
    if (localStorage.getItem(PERF_FLAG_KEY) === '1') return true
  } catch {
    /* fall through to the URL check */
  }
  return new URLSearchParams(window.location.search).get('perf') === '1'
}
