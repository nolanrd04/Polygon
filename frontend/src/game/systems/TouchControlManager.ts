import Phaser from 'phaser'
import type { Player } from '../entities/Player'
import { EventBus } from '../core/EventBus'
import { UpgradeEffectSystem } from './upgrades'

/**
 * Manages all touch-based input for mobile devices.
 * - Left joystick: movement
 * - Right joystick: rotation/shooting (inner = rotate, outer ring = shoot)
 * - Ability buttons: dash, shield
 * - Pause button: open menu
 */
export class TouchControlManager {
  private scene: Phaser.Scene
  private player: Player
  private isMobileDevice: boolean

  // Joystick properties
  private leftJoystick: VirtualJoystick | null = null
  private rightJoystick: VirtualJoystick | null = null

  // Ability buttons
  private dashButton: TouchButton | null = null
  private shieldButton: TouchButton | null = null

  // Pause and fullscreen buttons
  private pauseButton: Phaser.GameObjects.Rectangle | null = null
  private pauseSymbolLines: Phaser.GameObjects.Rectangle[] = []
  private fullscreenButton: Phaser.GameObjects.Rectangle | null = null
  private fullscreenText: Phaser.GameObjects.Text | null = null

  private resizeCallback: () => void = () => {}

  // Layout constants (shared so repositionControls stays in sync)
  private static readonly JOYSTICK_RADIUS = 55
  private static readonly JOYSTICK_INNER_RADIUS = 30
  // Distance from screen edge to joystick center (x and y independently)
  private static readonly JOYSTICK_PAD_X = 100  // 55 radius + 45px side buffer
  private static readonly JOYSTICK_PAD_Y = 77   // 55 radius + 22px bottom buffer
  private static readonly BUTTON_SIZE = 65
  private static readonly PAUSE_BUTTON_SIZE = 52
  private static readonly EDGE_PAD = 14

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene
    this.player = player
    this.isMobileDevice = this.detectMobileDevice()

    if (this.isMobileDevice) {
      this.initializeTouchControls()
    }
  }

  private detectMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  }

  private initializeTouchControls(): void {

    this.createJoysticks()
    this.createAbilityButtons()
    this.createPauseButton()
    this.createFullscreenButton()
    this.setupTouchHandlers()

    // Reposition everything when orientation changes
    this.resizeCallback = () => this.repositionControls()
    this.scene.scale.on('resize', this.resizeCallback)
  }

  private get W(): number { return this.scene.scale.width }
  private get H(): number { return this.scene.scale.height }

  private joystickPositions() {
    return {
      leftX: TouchControlManager.JOYSTICK_PAD_X,
      rightX: this.W - TouchControlManager.JOYSTICK_PAD_X,
      bottomY: this.H - TouchControlManager.JOYSTICK_PAD_Y,
    }
  }

  private createJoysticks(): void {
    const { leftX, rightX, bottomY } = this.joystickPositions()
    const r = TouchControlManager.JOYSTICK_RADIUS
    const ir = TouchControlManager.JOYSTICK_INNER_RADIUS

    this.leftJoystick = new VirtualJoystick(this.scene, leftX, bottomY, r, ir, 0x3366ff)
    this.rightJoystick = new VirtualJoystick(this.scene, rightX, bottomY, r, ir, 0xff6633)
  }

  private abilityButtonPositions() {
    const p = TouchControlManager.EDGE_PAD
    const sz = TouchControlManager.PAUSE_BUTTON_SIZE
    const btnSize = TouchControlManager.BUTTON_SIZE
    const spacing = 50
    const y = p + sz / 2

    // Shield: 50px to the left of the FS button
    const fsX = this.W / 2 - p / 2 - sz / 2
    const shieldX = fsX - sz / 2 - spacing - btnSize / 2

    // Dash: 50px to the right of the Pause button
    const pauseX = this.W / 2 + p / 2 + sz / 2
    const dashX = pauseX + sz / 2 + spacing + btnSize / 2

    return { dashX, dashY: y, shieldX, shieldY: y }
  }

  private createAbilityButtons(): void {
    const { dashX, dashY, shieldX, shieldY } = this.abilityButtonPositions()
    const btnSize = TouchControlManager.BUTTON_SIZE

    this.dashButton = new TouchButton(
      this.scene, dashX, dashY, btnSize, 'DASH', 0x44dd44,
      () => this.player.dash()
    )

    this.shieldButton = new TouchButton(
      this.scene, shieldX, shieldY, btnSize, 'SHIELD', 0x44dddd,
      () => this.player.activateShield()
    )
  }

  private pauseButtonPosition() {
    const p = TouchControlManager.EDGE_PAD
    const sz = TouchControlManager.PAUSE_BUTTON_SIZE
    // Pause: center-top, slightly right of center
    return { x: this.W / 2 + p / 2 + sz / 2, y: p + sz / 2 }
  }

  private fullscreenButtonPosition() {
    const p = TouchControlManager.EDGE_PAD
    const sz = TouchControlManager.PAUSE_BUTTON_SIZE
    // FS: center-top, slightly left of center
    return { x: this.W / 2 - p / 2 - sz / 2, y: p + sz / 2 }
  }

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

    this.pauseButton.on('pointerdown', () => {
      EventBus.emit('game-pause')
    })
  }

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
  }

  private setupTouchHandlers(): void {
    // Touch handlers managed by joysticks
  }

  private repositionControls(): void {
    const { leftX, rightX, bottomY } = this.joystickPositions()
    const { dashX, dashY, shieldX, shieldY } = this.abilityButtonPositions()
    const pause = this.pauseButtonPosition()
    const fs = this.fullscreenButtonPosition()

    this.leftJoystick?.reposition(leftX, bottomY)
    this.rightJoystick?.reposition(rightX, bottomY)

    this.dashButton?.reposition(dashX, dashY)
    this.shieldButton?.reposition(shieldX, shieldY)

    if (this.pauseButton) this.pauseButton.setPosition(pause.x, pause.y)
    for (let i = 0; i < this.pauseSymbolLines.length; i++) {
      this.pauseSymbolLines[i].setPosition(pause.x, pause.y - 11 + i * 11)
    }

    if (this.fullscreenButton) this.fullscreenButton.setPosition(fs.x, fs.y)
    if (this.fullscreenText) this.fullscreenText.setPosition(fs.x, fs.y)
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
  }

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
    this.dashButton?.setVisible(UpgradeEffectSystem.hasAbility('dash'))
    this.shieldButton?.setVisible(UpgradeEffectSystem.getEffectValue('shield') > 0)
  }

  destroy(): void {
    if (this.leftJoystick) this.leftJoystick.destroy()
    if (this.rightJoystick) this.rightJoystick.destroy()
    if (this.dashButton) this.dashButton.destroy()
    if (this.shieldButton) this.shieldButton.destroy()
    if (this.pauseButton) this.pauseButton.destroy()
    for (const line of this.pauseSymbolLines) {
      line.destroy()
    }
    if (this.fullscreenButton) this.fullscreenButton.destroy()
    if (this.fullscreenText) this.fullscreenText.destroy()
    this.scene.scale.off('resize', this.resizeCallback)
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

  // Convert a DOM clientX/Y to Phaser game coordinates.
  // Uses canvas.getBoundingClientRect() directly so it always matches the
  // actual rendered position of scroll-factor-0 objects (no camera offset/zoom applied).
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

/**
 * A touch-responsive button for abilities.
 */
class TouchButton {
  private button: Phaser.GameObjects.Rectangle
  private text: Phaser.GameObjects.Text
  private callback: () => void
  private isPressed: boolean = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
    label: string,
    color: number,
    callback: () => void
  ) {
    this.callback = callback

    this.button = scene.add
      .rectangle(x, y, size, size, color, 0.9)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(450)
      .setScrollFactor(0)

    this.text = scene.add
      .text(x, y, label, { font: 'bold 13px Arial', color: '#000000' })
      .setOrigin(0.5)
      .setDepth(451)
      .setScrollFactor(0)

    this.button.on('pointerdown', () => {
      this.isPressed = true
      this.button.setAlpha(0.6)
      this.callback()
    })

    this.button.on('pointerup', () => {
      this.isPressed = false
      this.button.setAlpha(0.9)
    })

    this.button.on('pointerout', () => {
      if (this.isPressed) {
        this.isPressed = false
        this.button.setAlpha(0.9)
      }
    })
  }

  setVisible(visible: boolean): void {
    this.button.setVisible(visible)
    this.text.setVisible(visible)
  }

  reposition(newX: number, newY: number): void {
    this.button.setPosition(newX, newY)
    this.text.setPosition(newX, newY)
  }

  destroy(): void {
    this.button.destroy()
    this.text.destroy()
  }
}