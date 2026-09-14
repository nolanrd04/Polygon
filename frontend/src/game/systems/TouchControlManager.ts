import Phaser from 'phaser'
import type { Player } from '../entities/Player'
import { EventBus } from '../core/EventBus'
import { IS_MOBILE } from '../core/Device'
import { TOUCH_LAYOUT } from '../core/TouchLayout'
import { ScreenSpaceLayer } from '../utils/ScreenSpaceLayer'

/**
 * Manages all touch-based input for mobile devices.
 * - Left joystick: movement
 * - Right joystick: rotation/shooting (inner = rotate, outer ring = shoot)
 * - Pause button: open menu
 *
 * ABILITIES ARE NOT HERE. They are fired by tapping their HUD card in
 * `AbilityDisplay.tsx`, which on mobile doubles as the button. This file used to
 * draw a second, parallel set of on-canvas ability buttons that repeated
 * everything the cards already showed — and the two then had to be laid out
 * around each other, which is what the whole stack-clamping apparatus existed for.
 *
 * Every control lives on a ScreenSpaceLayer, so all the layout below is in plain
 * screen pixels and stays that size no matter how far the mobile camera is zoomed
 * out. See ScreenSpaceLayer for why pinning alone would not have been enough.
 */
export class TouchControlManager {
  private scene: Phaser.Scene
  private player: Player
  private isMobileDevice: boolean

  /** Screen-pixel layer holding every control. Null on desktop (nothing to show). */
  private uiLayer: ScreenSpaceLayer | null = null

  // Joystick properties
  private leftJoystick: VirtualJoystick | null = null
  private rightJoystick: VirtualJoystick | null = null

  // Pause and fullscreen buttons
  private pauseButton: Phaser.GameObjects.Rectangle | null = null
  private pauseSymbolLines: Phaser.GameObjects.Rectangle[] = []
  // private fullscreenButton: Phaser.GameObjects.Rectangle | null = null
  // private fullscreenText: Phaser.GameObjects.Text | null = null

  private resizeCallback: () => void = () => {}

  // Layout constants. The values live in TOUCH_LAYOUT because the DOM ability
  // pads are positioned against these same joysticks — see TouchLayout.ts.
  private static readonly JOYSTICK_RADIUS = TOUCH_LAYOUT.joystickRadius
  private static readonly JOYSTICK_INNER_RADIUS = TOUCH_LAYOUT.joystickInnerRadius
  private static readonly JOYSTICK_PAD_X = TOUCH_LAYOUT.joystickPadX
  private static readonly JOYSTICK_PAD_X_TALL = TOUCH_LAYOUT.joystickPadXTall
  private static readonly JOYSTICK_PAD_Y = TOUCH_LAYOUT.joystickPadY
  private static readonly JOYSTICK_PAD_Y_TALL = TOUCH_LAYOUT.joystickPadYTall
  private static readonly PAUSE_BUTTON_SIZE = TOUCH_LAYOUT.pauseButtonSize
  private static readonly EDGE_PAD = TOUCH_LAYOUT.edgePad

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene
    this.player = player
    this.isMobileDevice = this.detectMobileDevice()

    if (this.isMobileDevice) {
      this.initializeTouchControls()
    }
  }

  private detectMobileDevice(): boolean {
    return IS_MOBILE
  }

  private initializeTouchControls(): void {
    // Depth 500 keeps the whole group above the play field (and well above the
    // light overlay at -5, so the controls are never darkened). Children are
    // added back to front inside it, since containers do not sort by depth.
    this.uiLayer = new ScreenSpaceLayer(this.scene, 500)

    this.createJoysticks()
    this.createPauseButton()
    // this.createFullscreenButton()
    this.setupTouchHandlers()

    // Reposition everything when orientation changes
    this.resizeCallback = () => this.repositionControls()
    this.scene.scale.on('resize', this.resizeCallback)
  }

  private get W(): number { return this.scene.scale.width }
  private get H(): number { return this.scene.scale.height }

  private joystickPositions() {
    const tall = this.H > 500
    const padX = tall ? TouchControlManager.JOYSTICK_PAD_X_TALL : TouchControlManager.JOYSTICK_PAD_X
    const padY = tall ? TouchControlManager.JOYSTICK_PAD_Y_TALL : TouchControlManager.JOYSTICK_PAD_Y
    return {
      leftX: padX,
      rightX: this.W - padX,
      bottomY: this.H - padY,
    }
  }

  private createJoysticks(): void {
    const { leftX, rightX, bottomY } = this.joystickPositions()
    const r = TouchControlManager.JOYSTICK_RADIUS
    const ir = TouchControlManager.JOYSTICK_INNER_RADIUS

    this.leftJoystick = new VirtualJoystick(this.scene, leftX, bottomY, r, ir, 0x3366ff)
    this.rightJoystick = new VirtualJoystick(this.scene, rightX, bottomY, r, ir, 0xff6633)

    if (this.uiLayer) {
      this.leftJoystick.attachTo(this.uiLayer)
      this.rightJoystick.attachTo(this.uiLayer)
    }
  }

  private pauseButtonPosition() {
    const p = TouchControlManager.EDGE_PAD
    const sz = TouchControlManager.PAUSE_BUTTON_SIZE
    // Pause: center-top, slightly right of center
    return { x: this.W / 2 + p / 2 + sz / 2, y: p + sz / 2 }
  }

  /*
  private fullscreenButtonPosition() {
    const p = TouchControlManager.EDGE_PAD
    const sz = TouchControlManager.PAUSE_BUTTON_SIZE
    // FS: center-top, slightly left of center
    return { x: this.W / 2 - p / 2 - sz / 2, y: p + sz / 2 }
  } */

  private createPauseButton(): void {
    const { x, y } = this.pauseButtonPosition()
    const sz = TouchControlManager.PAUSE_BUTTON_SIZE

    this.pauseButton = this.scene.add
      .rectangle(x, y, sz, sz, 0x222266, 0.92)
      .setOrigin(0.5, 0.5)
      .setInteractive()
      .setDepth(500)
      .setScrollFactor(0)

    this.pauseSymbolLines = []
    for (let i = 0; i < 3; i++) {
      const line = this.scene.add.rectangle(x, y - 11 + i * 11, 22, 3, 0xffffff)
      line.setOrigin(0.5, 0.5).setDepth(501).setScrollFactor(0)
      this.pauseSymbolLines.push(line)
    }

    this.uiLayer?.add(this.pauseButton, ...this.pauseSymbolLines)

    this.pauseButton.on('pointerdown', () => {
      EventBus.emit('game-pause')
    })
  }

  /*
  private createFullscreenButton(): void {
    const { x, y } = this.fullscreenButtonPosition()
    const sz = TouchControlManager.PAUSE_BUTTON_SIZE

    this.fullscreenButton = this.scene.add
      .rectangle(x, y, sz, sz, 0x226622, 0.92)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(500)
      .setScrollFactor(0)

    this.fullscreenText = this.scene.add
      .text(x, y, 'FS', { font: 'bold 16px Arial', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(501)
      .setScrollFactor(0)

    this.fullscreenButton.on('pointerdown', () => {
      this.toggleBrowserFullscreen()
    })
  }*/

  private setupTouchHandlers(): void {
    // Touch handlers managed by joysticks
  }

  private repositionControls(): void {
    const { leftX, rightX, bottomY } = this.joystickPositions()
    const pause = this.pauseButtonPosition()
    // const fs = this.fullscreenButtonPosition()

    this.leftJoystick?.reposition(leftX, bottomY)
    this.rightJoystick?.reposition(rightX, bottomY)

    if (this.pauseButton) this.pauseButton.setPosition(pause.x, pause.y)
    for (let i = 0; i < this.pauseSymbolLines.length; i++) {
      this.pauseSymbolLines[i].setPosition(pause.x, pause.y - 11 + i * 11)
    }

    // if (this.fullscreenButton) this.fullscreenButton.setPosition(fs.x, fs.y)
    // if (this.fullscreenText) this.fullscreenText.setPosition(fs.x, fs.y)
  }

  isTouchingJoystick(_pointer: Phaser.Input.Pointer): boolean {
    // On mobile, if either joystick is active, block direct-touch camera controls
    if (!this.leftJoystick || !this.rightJoystick) return false
    return this.leftJoystick.isActive() || this.rightJoystick.isActive()
  }

  isLeftJoystickActive(): boolean {
    return this.leftJoystick ? this.leftJoystick.isActive() : false
  }

  isRightJoystickActive(): boolean {
    return this.rightJoystick ? this.rightJoystick.isActive() : false
  }

  isMobile(): boolean {
    return this.isMobileDevice
  }

  /*
  private toggleBrowserFullscreen(): void {
    const doc = document.documentElement
    const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement)

    if (isFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
      }
    } else {
      if (doc.requestFullscreen) {
        doc.requestFullscreen()
      } else if ((doc as any).webkitRequestFullscreen) {
        (doc as any).webkitRequestFullscreen()
      }
    }
  }*/

  private updateJoystickInput(): void {
    if (!this.leftJoystick || !this.rightJoystick) return

    const leftForce = this.leftJoystick.getForce()
    this.player.move(leftForce.x, leftForce.y)

    const rightForce = this.rightJoystick.getForce()
    if (rightForce.magnitude > 0) {
      const targetX = this.player.x + Math.cos(rightForce.angle) * 100
      const targetY = this.player.y + Math.sin(rightForce.angle) * 100
      this.player.rotateTowards(targetX, targetY)

      if (rightForce.magnitude > 0.5) {
        this.player.shoot(targetX, targetY)
      }
    }
  }

  update(): void {
    if (this.leftJoystick) this.leftJoystick.update()
    if (this.rightJoystick) this.rightJoystick.update()
    this.updateJoystickInput()
  }

  destroy(): void {
    if (this.leftJoystick) this.leftJoystick.destroy()
    if (this.rightJoystick) this.rightJoystick.destroy()
    if (this.pauseButton) this.pauseButton.destroy()
    for (const line of this.pauseSymbolLines) {
      line.destroy()
    }
    // if (this.fullscreenButton) this.fullscreenButton.destroy()
    // if (this.fullscreenText) this.fullscreenText.destroy()
    this.uiLayer?.destroy()
    this.uiLayer = null
    this.scene.scale.off('resize', this.resizeCallback)
  }

  /**
   * Re-pin the controls after the camera zoom changes. The layer already handles
   * resizes itself; this is for zoom changes that arrive without one.
   */
  syncToCamera(): void {
    this.uiLayer?.sync()
  }
}

/**
 * A virtual joystick that responds to touch input.
 *
 * Uses raw DOM touch events + canvas.getBoundingClientRect() so that the
 * touch coordinate space always matches the Phaser game coordinate space,
 * regardless of CSS scaling, autoCenter margins, or DPR differences.
 */
class VirtualJoystick {
  centerX: number
  centerY: number
  private radius: number
  private canvas: HTMLCanvasElement
  private scene: Phaser.Scene

  private outerCircle: Phaser.GameObjects.Ellipse
  private innerCircle: Phaser.GameObjects.Ellipse
  private knob: Phaser.GameObjects.Ellipse

  // identifier from Touch.identifier (-1 = inactive)
  private activeTouchId: number = -1

  private forceX: number = 0
  private forceY: number = 0

  // Bound listener references so we can remove them on destroy
  private onTouchStart: (e: TouchEvent) => void
  private onTouchMove: (e: TouchEvent) => void
  private onTouchEnd: (e: TouchEvent) => void

  constructor(
    scene: Phaser.Scene,
    centerX: number,
    centerY: number,
    radius: number,
    innerRadius: number,
    color: number
  ) {
    this.centerX = centerX
    this.centerY = centerY
    this.radius = radius
    this.canvas = scene.sys.game.canvas
    this.scene = scene

    this.outerCircle = scene.add
      .ellipse(centerX, centerY, radius * 2, radius * 2, color, 0.25)
      .setOrigin(0.5, 0.5)
      .setDepth(400)
      .setScrollFactor(0)

    this.innerCircle = scene.add
      .ellipse(centerX, centerY, innerRadius * 2, innerRadius * 2, color, 0.4)
      .setOrigin(0.5, 0.5)
      .setDepth(401)
      .setScrollFactor(0)

    this.knob = scene.add
      .ellipse(centerX, centerY, 36, 36, 0xffffff, 0.85)
      .setOrigin(0.5, 0.5)
      .setDepth(402)
      .setScrollFactor(0)

    // Raw DOM listeners — coordinates come from the same coordinate system
    // as the canvas's getBoundingClientRect(), so they always match game coords.
    this.onTouchStart = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (this.activeTouchId !== -1) break
        const pos = this.clientToGame(touch.clientX, touch.clientY)
        if (this.isWithinBounds(pos.x, pos.y)) {
          this.activeTouchId = touch.identifier
          this.updateFromXY(pos.x, pos.y)
        }
      }
    }

    this.onTouchMove = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.activeTouchId) {
          const pos = this.clientToGame(touch.clientX, touch.clientY)
          this.updateFromXY(pos.x, pos.y)
          break
        }
      }
    }

    this.onTouchEnd = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.activeTouchId) {
          this.activeTouchId = -1
          this.forceX = 0
          this.forceY = 0
          this.knob.x = this.centerX
          this.knob.y = this.centerY
          break
        }
      }
    }

    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true })
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true })
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: true })
    this.canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: true })
  }

  // Convert a DOM clientX/Y to screen-pixel game coordinates.
  // Uses canvas.getBoundingClientRect() directly, so it survives CSS scaling and
  // DPR differences. It carries no camera terms, which is exactly why the circles
  // have to live on a ScreenSpaceLayer: that layer is what guarantees a control
  // authored at (x, y) is still drawn at screen pixel (x, y) once the mobile
  // camera zooms out, keeping this coordinate space and the visuals in agreement.
  private clientToGame(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.scene.scale.width / rect.width
    const scaleY = this.scene.scale.height / rect.height
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  private isWithinBounds(x: number, y: number): boolean {
    return Math.hypot(x - this.centerX, y - this.centerY) < this.radius + 20
  }

  private updateFromXY(x: number, y: number): void {
    const dx = x - this.centerX
    const dy = y - this.centerY
    const distance = Math.hypot(dx, dy)

    if (distance > this.radius) {
      const angle = Math.atan2(dy, dx)
      this.forceX = Math.cos(angle)
      this.forceY = Math.sin(angle)
      this.knob.x = this.centerX + Math.cos(angle) * this.radius
      this.knob.y = this.centerY + Math.sin(angle) * this.radius
    } else {
      this.forceX = distance > 0 ? dx / this.radius : 0
      this.forceY = distance > 0 ? dy / this.radius : 0
      this.knob.x = x
      this.knob.y = y
    }
  }

  getForce(): { x: number; y: number; magnitude: number; angle: number } {
    const magnitude = Math.hypot(this.forceX, this.forceY)
    const angle = Math.atan2(this.forceY, this.forceX)
    return { x: this.forceX, y: this.forceY, magnitude, angle }
  }

  isActive(): boolean {
    return this.activeTouchId !== -1
  }

  reposition(newCenterX: number, newCenterY: number): void {
    this.centerX = newCenterX
    this.centerY = newCenterY
    this.outerCircle.setPosition(newCenterX, newCenterY)
    this.innerCircle.setPosition(newCenterX, newCenterY)
    this.knob.setPosition(newCenterX, newCenterY)
  }

  /** Hand the graphics to a screen-pixel layer, back to front. */
  attachTo(layer: ScreenSpaceLayer): void {
    layer.add(this.outerCircle, this.innerCircle, this.knob)
  }

  update(): void { /* reserved */ }

  destroy(): void {
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    this.canvas.removeEventListener('touchmove', this.onTouchMove)
    this.canvas.removeEventListener('touchend', this.onTouchEnd)
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd)
    this.outerCircle.destroy()
    this.innerCircle.destroy()
    this.knob.destroy()
  }
}
