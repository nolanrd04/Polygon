/**
 * Device detection for the game layer.
 *
 * Deliberately import-free so anything (GameConfig, scenes, systems) can pull it
 * in without creating a module cycle.
 *
 * The test is user-agent based, which means Chrome DevTools' device emulation
 * reproduces it exactly — pick a device preset (not "Responsive", which keeps the
 * desktop UA) and reload. The value is computed once at module load, so toggling
 * device mode on an already-running page needs a refresh.
 *
 * NOTE: the React HUD components (GameHUD, AbilityDisplay, UpgradeModal,
 * PerfOverlay) each still carry their own copy of this regex — they are outside
 * the game layer and were left alone. DevTools has moved onto this const. If the
 * rest follow, keep the pattern identical, so the canvas and the DOM overlay
 * never disagree about which layout they are drawing.
 */
const UA_IS_MOBILE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

/**
 * `?mobile=1` forces the mobile layout on, `?mobile=0` forces it off.
 *
 * Purely a development affordance: it lets a desktop browser exercise the mobile
 * camera zoom and the touch-control layout by resizing the window, with no device
 * emulation and no reaching for a phone. Nothing ships behind it — the override is
 * absent for real players, who fall through to the user-agent test.
 *
 * It does NOT fake touch events, so the joysticks will still be undraggable with a
 * mouse. For that, DevTools device emulation is still the right tool.
 */
function mobileOverride(): boolean | null {
  const param = new URLSearchParams(window.location.search).get('mobile')
  if (param === null) return null
  return param !== '0' && param !== 'false'
}

export const IS_MOBILE = mobileOverride() ?? UA_IS_MOBILE