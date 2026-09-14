import Phaser from 'phaser'

/**
 * A container whose children are laid out in SCREEN pixels, immune to camera zoom.
 *
 * WHY setScrollFactor(0) IS NOT ENOUGH
 * A scroll-factor-0 object ignores camera *scroll*, but not camera *zoom*: Phaser
 * builds its camera matrix as `translate(c) . scale(zoom) . translate(-c)` about
 * the camera centre and runs every object through it, pinned or not. So the
 * moment the camera pulls back for mobile (MOBILE_CAMERA_ZOOM in GameConfig) the
 * joysticks shrink and slide toward the middle of the screen, and the raw DOM
 * touch listeners — which read real client pixels — stop lining up with the
 * circles the player can see.
 *
 * WHAT THIS DOES
 * It cancels that transform exactly, so a child placed at (x, y) lands on screen
 * pixel (x, y) at its authored size whatever the zoom is. Layout code and hit
 * tests both go on working in plain screen coordinates with no zoom terms in them.
 *
 * THE MATHS
 * The camera puts a pinned point P at `screen = c + zoom * (P - c)`, where
 * `c = camera.width / 2` (its origin is centred). A child at local offset `l`
 * inside a container at `pos` with scale `s` sits at `P = pos + s * l`, so
 *
 *     screen = c + zoom * (pos + s * l - c)
 *
 * Choosing `s = 1/zoom` and `pos = c * (1 - 1/zoom)` collapses that to
 * `screen = l`. Phaser walks the same parent-matrix chain when hit-testing
 * interactive children, so pointer input follows the pixels for free.
 *
 * ORDERING
 * Containers render children in insertion order and do NOT sort by depth, so add
 * objects back-to-front. Each child must keep its own `setScrollFactor(0)`: the
 * child's scroll factor is applied again relative to the container, and a
 * stray 1 would reintroduce the camera scroll this layer is meant to cancel.
 */
export class ScreenSpaceLayer {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private resizeCallback: () => void

  /**
   * @param depth Scene depth for the layer as a whole. Children's own depths only
   *              order them against each other, so this is what decides where the
   *              whole group sits relative to the rest of the scene.
   */
  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene
    this.container = scene.add.container(0, 0)
    this.container.setDepth(depth)
    this.container.setScrollFactor(0)

    this.resizeCallback = () => this.sync()
    scene.scale.on('resize', this.resizeCallback)

    this.sync()
  }

  /**
   * Re-pin the layer to the current camera. Called on every resize, and must also
   * be called by hand after anything changes `camera.zoom`.
   */
  sync(): void {
    const camera = this.scene.cameras?.main
    if (!camera || !camera.zoom) return

    const inverse = 1 / camera.zoom
    this.container.setScale(inverse)
    this.container.setPosition(
      (camera.width / 2) * (1 - inverse),
      (camera.height / 2) * (1 - inverse)
    )
  }

  /** Adopt objects already created via `scene.add.*`, back to front. */
  add(...objects: Phaser.GameObjects.GameObject[]): void {
    this.container.add(objects)
  }

  destroy(): void {
    this.scene.scale.off('resize', this.resizeCallback)
    this.container.destroy() // takes its children with it
  }
}