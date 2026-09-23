import { Enemy } from './Enemy'
import { TrailRenderer } from '../../utils/TrailRenderer'
import { TextureGenerator } from '../../utils/TextureGenerator'
import { LightingSystem } from '../../../game/systems/LightingSystem'
import { LightingIntensityID } from '../../../game/data/ID'

export class SuperDiamond extends Enemy {
    private baseSpeed: number = 80
    private maxDashSpeed: number = 650
    private waitTime: number = 3000
    private dashTime: number = 750
    private recoverTime: number = 1000
    private phase: 'wait' | 'dash' | 'recover' = 'wait'
    private phaseStartTime: number = 0
    private dashDirection: number = 0 // Store direction for dash
    private dashCount: number = 0
    private hasOutline: boolean = false


  SetDefaults(): void {
    this.health = 210
    this.speed = 80
    this.damage = 75
    this.sides = 4
    this.radius = 22
    this.color = 0xfcf003
    this.scoreChance = .1
    this.speedCap = 6.5
    this.doOldPositionTracking = true
    this.doOldRotationTracking = true  // NEW: Track rotation for trails
    this.oldTrackingCounter = 3
    this.oldTrackingInterval = 100
    this.scale = .85
    this.baseSpeed = this.speed
    this.phase = 'wait'
    this.phaseStartTime = 0
    this.knockbackResistance = .95
    this.bundleDropChance = 0 // use difficulty drop chance
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
    const now = this.scene.time.now
    if (this.phaseStartTime === 0) {
      this.phaseStartTime = now
    }
    const elapsed = now - this.phaseStartTime

    // Phase 1: Wait at base speed
    if (this.phase === 'wait') {
      this.speed = this.baseSpeed
      // Continue moving towards player during wait phase
      this.moveTowards(playerX, playerY)
      this.collideWithEnemies = true

      if (elapsed >= this.waitTime) {
        this.phase = 'dash'
        this.phaseStartTime = now
        // Capture dash direction at start of dash phase
        this.dashDirection = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
      }
    }
    // Phase 2: Dash up
    else if (this.phase === 'dash') {
      const dashProgress = Math.min(elapsed / this.dashTime, 1)
      this.speed = Phaser.Math.Linear(this.baseSpeed, this.maxDashSpeed, dashProgress)

      // Move in fixed dash direction
      this.velocityX = Math.cos(this.dashDirection) * this.speed
      this.velocityY = Math.sin(this.dashDirection) * this.speed
      this.rotation = this.dashDirection + Math.PI / 2

      this.collideWithEnemies = false

      if (elapsed >= this.dashTime) {
        if (this.dashCount < 2)
        {
          this.dashCount++
          this.phaseStartTime = now
          this.dashDirection = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        }
        else
        {
          this.phase = 'recover'
          this.phaseStartTime = now
          this.dashCount = 0 // reset dash count for next cycle
        }
      }
    }
    // Phase 3: Recover
    else {
      const recoverProgress = Math.min(elapsed / this.recoverTime, 1)
      this.speed = Phaser.Math.Linear(this.maxDashSpeed, this.baseSpeed, recoverProgress)
      // Maintain dash direction while slowing down
      this.velocityX = Math.cos(this.dashDirection) * this.speed
      this.velocityY = Math.sin(this.dashDirection) * this.speed
      this.rotation = this.dashDirection + Math.PI / 2

      if (elapsed >= this.recoverTime) {
        this.phase = 'wait'
        this.phaseStartTime = now
      }
    }
  }

  moveTowards(targetX: number, targetY: number): void {
    const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY)
    // if its not dashing and close, move away from the player
    if (this.phase === 'wait' && distanceToPlayer < 500) 
    {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)
      const targetVelX = -Math.cos(angle) * this.speed
      const targetVelY = -Math.sin(angle) * this.speed

      // Lerp velocity for smooth movement (0.15 = smoothing factor)
      const smoothing = 0.15
      this.velocityX = Phaser.Math.Linear(this.velocityX, targetVelX, smoothing)
      this.velocityY = Phaser.Math.Linear(this.velocityY, targetVelY, smoothing)

      // Lerp rotation for smooth turning
      this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, angle + Math.PI / 2, 0.1)
    }
    else
    {
      super.moveTowards(targetX, targetY)
    }
  }

  /**
   * Render sprite trail using old positions WITH ROTATION
   */
  PostDraw(): void {
    // Emitted here rather than from AI(): Enemy gates AI() on the knockback
    // timer, and lights are immediate-mode, so a light emitted from AI() blinks
    // out for the ~6 frames of every knockback.
    LightingSystem.AddLight(this.x, this.y, this.color, LightingIntensityID.Entity * this.radius / 35)

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
        duration: 0,
        scale: this.scale * .85,
        scaleDecay: true
      })
    }

    if (!this.hasOutline) {
        // Generate outline texture on-demand with larger radius and no fill
        const outlineKey = TextureGenerator.getOrCreateDiamond(this.scene, {
          radius: this.radius + 6,  // Larger radius for outline effect
          fillColor: 0x000000,
          fillAlpha: 0,  // Transparent fill
          strokeWidth: 2,
          strokeColor: 0xffffff,
          strokeAlpha: 0.8
        })
  
        const outlineSprite = this.scene.add.sprite(0, 0, outlineKey)
        outlineSprite.setScale(TextureGenerator.getDisplayScale())  // Scale down high-res texture
        this.container.add(outlineSprite)
        this.hasOutline = true
      }
  }

}