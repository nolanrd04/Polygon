/**
 * Geometry of the mobile touch layout, in SCREEN pixels.
 *
 * Shared because the layout now spans two rendering layers: the joysticks and
 * pause button are Phaser objects on the canvas (TouchControlManager), while the
 * ability pads are DOM buttons (AbilityDisplay.tsx) that have to land in exactly
 * the slots the on-canvas ability buttons used to occupy — above the joysticks,
 * clear of the pause button. Two copies of these numbers would drift apart the
 * first time one was tuned.
 *
 * Under `Phaser.Scale.RESIZE` the canvas is sized 1:1 with the viewport in CSS
 * pixels, so a screen coordinate here means the same thing to both layers.
 *
 * Deliberately import-free, like Device.ts, so either layer can pull it in.
 */
export const TOUCH_LAYOUT = {
  /** Above this viewport height, the layout is "tall": portrait phone or any tablet. */
  tallScreenMinHeight: 500,

  joystickRadius: 55,
  joystickInnerRadius: 30,
  /** Distance from the screen edge to a joystick centre, x and y independently. */
  joystickPadX: 100,      // landscape / short screen
  joystickPadXTall: 70,   // portrait / tall screen — tune this
  joystickPadY: 77,       // 55 radius + 22px bottom buffer
  joystickPadYTall: 140,  // extra upward shift on tall screens

  pauseButtonSize: 52,
  edgePad: 14,

  /** Ability pads are square. */
  abilityButtonSize: 65,
  /** X distance from the edge to a pad's outer edge, on tall screens. */
  abilitySidePad: 25,
  /** Gap between the top of the joysticks and the bottom of the first pad pair. */
  abilityStackOffset: 250,
  /** Vertical gap between one pad pair and the next, on tall screens. */
  abilityStackGap: 15,
  /** Tightest that gap may compress to before the pads start touching. */
  abilityStackMinGap: 2,
  /** Hard floor on abilityStackOffset, so a slid-down stack never reaches the joysticks. */
  abilityStackMinOffset: 60,
  /** Breathing room between the bottom of the DOM HUD and the topmost pad. */
  abilityHudClearance: 8,
  /** Horizontal gap between the pause button and the first pad, on short screens. */
  abilityShortSpacing: 50,
  /** Horizontal gap between pads, on short screens. */
  abilityShortGap: 20,
} as const

/**
 * Where pad pair 0 sits and how far apart the pairs are, on tall screens.
 *
 * The stack is anchored to the JOYSTICKS and grows upward, which is what keeps
 * the pads under the thumb on every device — anchoring to the HUD instead would
 * float them halfway up an iPad. The cost is that on a short screen the stack
 * climbs into the DOM HUD along the top: the health readout, the wave/points
 * block, and the perf overlay parked under it.
 *
 * Three stages, cheapest first, each only doing what the one before could not:
 *
 *   1. COMPRESS the gap between pairs, down to `abilityStackMinGap`. Pair 0 never
 *      moves, so the reachable anchor is untouched. This is worth at most
 *      `maxRank * (abilityStackGap - abilityStackMinGap)` pixels — with three
 *      abilities that is a single row's worth, so it rarely suffices alone. It
 *      does all the work once there are enough abilities to stack deep.
 *   2. SLIDE the whole stack down as a unit, keeping the spacing from (1), until
 *      its top edge clears the ceiling. This is what handles a short screen,
 *      where pair 0's own top edge is already above the HUD's bottom and there is
 *      nothing left to compress.
 *   3. CLAMP so the slide never pushes pair 0 into the joysticks.
 *
 * Priority under (3): on a screen too short to satisfy both, the joysticks win
 * and the HUD is allowed to overlap. A pad hidden under the FPS readout is still
 * tappable; one under the movement stick is not.
 *
 * One step is shared by both columns rather than a ceiling per side, so pairs
 * stay level with each other. The right column is usually the binding one — the
 * wave block is taller than the health block, and the perf overlay sits below it.
 */
function tallStackLayout(
  viewHeight: number,
  ceiling: number,
  padCount: number
): { anchorY: number; step: number } {
  const L = TOUCH_LAYOUT
  const size = L.abilityButtonSize
  const half = size / 2

  const bottomY = viewHeight - L.joystickPadYTall
  const idealAnchor = bottomY - L.joystickRadius - L.abilityStackOffset - half
  const maxRank = Math.max(0, Math.ceil(padCount / 2) - 1)
  const idealStep = size + L.abilityStackGap

  // 1. Compress.
  let step = idealStep
  if (maxRank > 0) {
    const room = idealAnchor - half - ceiling
    step = Math.min(idealStep, Math.max(size + L.abilityStackMinGap, room / maxRank))
  }

  // 2. Slide the stack down until its top edge clears the ceiling.
  let anchorY = idealAnchor
  const topEdge = anchorY - maxRank * step - half
  if (topEdge < ceiling) anchorY += ceiling - topEdge

  // 3. Never into the joysticks.
  const lowest = bottomY - L.joystickRadius - L.abilityStackMinOffset - half
  return { anchorY: Math.min(anchorY, lowest), step }
}

/**
 * Top-left corner of the ability pad at `index`, in screen pixels.
 *
 * `index` is the ability's position among ALL registered bindings, not among the
 * ones currently owned, so a given ability keeps the same slot for the whole run
 * rather than sliding about as others are picked up. `padCount` is likewise the
 * total binding count, so the stack's extent — and therefore how much it has to
 * compress — does not change as abilities are acquired.
 *
 * `ceiling` is the screen Y the stack must stay below, i.e. the bottom of the
 * lowest-reaching DOM HUD element plus clearance. The caller supplies it because
 * the pieces that set it (`hudBlockBottom()`, `perfOverlayBottom()`) live with
 * the components they measure, and the perf overlay's height depends on which
 * mode it is in.
 *
 * Pads alternate sides — **even index left, odd right** — and each further pair
 * steps inward from the edge: tall screens stack upward from above the joysticks,
 * short screens spread outward from beside the pause button. Index 0 and 1 land
 * exactly where the original hardcoded shield/dash pair sat.
 */
export function abilityPadPosition(
  index: number,
  viewWidth: number,
  viewHeight: number,
  ceiling: number,
  padCount: number
): { left: number; top: number; size: number } {
  const L = TOUCH_LAYOUT
  const size = L.abilityButtonSize
  const half = size / 2

  const onLeft = index % 2 === 0
  const rank = Math.floor(index / 2)  // 0 for the first pair, 1 for the next, ...

  if (viewHeight > L.tallScreenMinHeight) {
    // Tall screen: above the joysticks, stacking later pairs upward.
    const { anchorY, step } = tallStackLayout(viewHeight, ceiling, padCount)
    const centreY = anchorY - rank * step
    const centreX = onLeft ? L.abilitySidePad + half : viewWidth - L.abilitySidePad - half
    return { left: centreX - half, top: centreY - half, size }
  }

  // Short screen (landscape phone): beside the pause button, spreading outward.
  const p = L.edgePad
  const sz = L.pauseButtonSize
  const step = rank * (size + L.abilityShortGap)
  const fsX = viewWidth / 2 - p / 2 - sz / 2
  const pauseX = viewWidth / 2 + p / 2 + sz / 2
  const centreX = onLeft
    ? fsX - sz / 2 - L.abilityShortSpacing - half - step
    : pauseX + sz / 2 + L.abilityShortSpacing + half + step
  return { left: centreX - half, top: p + sz / 2 - half, size }
}