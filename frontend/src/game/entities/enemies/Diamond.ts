import { Enemy } from './Enemy'
import { TrailRenderer } from '../../utils/TrailRenderer'
import { TextureGenerator } from '../../utils/TextureGenerator'

export class Diamond extends Enemy {
    private baseSpeed: number = 100
    private maxDashSpeed: number = 500
    private waitFrames: number = 240 // ~4 seconds at 60fps
    private dashFrames: number = 60 // ~1 second at 60fps
    private recoverFrames: number = 60 // ~1 second at 60fps
    private frameCounter: number = 0
    private dashDirection: number = 0 // Store direction for dash

  SetDefaults(): void {
    this.health = 50
    this.speed = 100
    this.damage = 50
    this.sides = 4
    this.radius = 25
    this.color = 0xfcf003
    this.scoreChance = .45
    this.speedCap = 2.5
    this.doOldPositionTracking = true
    this.doOldRotationTracking = true  // NEW: Track rotation for trails
    this.oldTrackingCounter = 3
    this.oldTrackingInterval = 100
    this.scale = .8
    this.baseSpeed = this.speed
    this.frameCounter = 0
  }

  PreAI(): boolean {
      return true
  }

  /**
   * Use diamond texture instead of square polygon
   */
  Draw(): void {
    // First time: replace the sprite with diamond texture
    if (!this.sprite.texture.key.startsWith('diamond_')) {
      // Generate diamond texture on-demand
      const textureKey = TextureGenerator.getOrCreateDiamond(this.scene, {
        radius: this.radius,
        fillColor: 0xd9d9d9,  // Light gray for visible stroke when tinted
        fillAlpha: 1.0,
        strokeWidth: 3,
        strokeColor: 0xffffff,
        strokeAlpha: 1.0
      })

      const oldSprite = this.sprite
      this.sprite = this.scene.add.sprite(0, 0, textureKey)
      this.sprite.setTint(this.color)
      this.sprite.setScale(this.scale * TextureGenerator.getDisplayScale())  // Apply both scales
      this.container.add(this.sprite)
      oldSprite.destroy()
    }

    // Call base class to update tint
    super.Draw()
  }

  AI(playerX: number, playerY: number): void {
    const totalFrames = this.waitFrames + this.dashFrames + this.recoverFrames

    // Phase 1: Wait at base speed (0 - waitFrames)
    if (this.frameCounter < this.waitFrames) {
      this.speed = this.baseSpeed
      // Continue moving towards player during wait phase
      this.moveTowards(playerX, playerY)
    }
    // Phase 2: Dash up (waitFrames - waitFrames + dashFrames)
    else if (this.frameCounter < this.waitFrames + this.dashFrames) {
      // Capture dash direction at start of dash phase
      if (this.frameCounter === this.waitFrames) {
        this.dashDirection = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
      }

      const dashProgress = (this.frameCounter - this.waitFrames) / this.dashFrames
      this.speed = Phaser.Math.Linear(this.baseSpeed, this.maxDashSpeed, dashProgress)

      // Move in fixed dash direction
      this.velocityX = Math.cos(this.dashDirection) * this.speed
      this.velocityY = Math.sin(this.dashDirection) * this.speed
      this.rotation = this.dashDirection + Math.PI / 2
    }
    // Phase 3: Recover (waitFrames + dashFrames - total)
    else {
      const recoverProgress = (this.frameCounter - this.waitFrames - this.dashFrames) / this.recoverFrames
      this.speed = Phaser.Math.Linear(this.maxDashSpeed, this.baseSpeed, recoverProgress)
      // Maintain dash direction while slowing down
      this.velocityX = Math.cos(this.dashDirection) * this.speed
      this.velocityY = Math.sin(this.dashDirection) * this.speed
      this.rotation = this.dashDirection + Math.PI / 2
    }

    // Increment frame counter and reset when cycle completes
    this.frameCounter++
    if (this.frameCounter >= totalFrames) {
      this.frameCounter = 0
    }
  }

  /**
   * Render sprite trail using old positions WITH ROTATION
   */
  PostDraw(): void {
    if (this.doOldPositionTracking && this.oldPositionX.length > 0) {
      // Generate diamond trail texture (same as main sprite)
      const textureKey = TextureGenerator.getOrCreateDiamond(this.scene, {
        radius: this.radius,
        fillColor: 0xd9d9d9,
        fillAlpha: 1.0,
        strokeWidth: 3,
        strokeColor: 0xffffff,
        strokeAlpha: 1.0
      })

      const positions = this.oldPositionX.map((x, i) => ({
        x,
        y: this.oldPositionY[i]
      }))

      TrailRenderer.renderTrail(this.scene, {
        positions,
        rotations: this.oldRotations,  // NEW: Pass rotations for trail
        textureKey,
        tint: this.color,
        maxAlpha: 0.4,
        duration: 300,
        scale: this.scale,
        scaleDecay: true
      })
    }
  }

}