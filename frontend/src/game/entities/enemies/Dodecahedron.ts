import { TextureGenerator } from '../../utils/TextureGenerator'
import { Enemy } from './Enemy'
import { TrailRenderer } from '../../utils/TrailRenderer'

export class Dodecahedron extends Enemy {
  private invincible: boolean = false
  // spawn animation variables
  private spawnImmunityDuration: number = 1000 // 1 second in milliseconds
  private spawnStartTime: number = 0
  private spawnScale = 1.3

  // onHit() variables
  private hitColor = 0xb067f5
  private hitColorTimer: Phaser.Time.TimerEvent | null = null
  private readonly defaultColor = 0x8a2be2

  // phase tracker
  private phase: number = 1
  private phaseStyle: number = 0
  private phaseStartTime: number = 0
  private phaseDuration: number = 6000 // 6 seconds in milliseconds

  // phase one variables
  private dashing: boolean = false
  private dashDuration: number = 800
  private dashCooldownDuration: number = 350
  private dashCount: number = 0
  private dashSpeed: number = 500
  private dashDirection: number = 0 // Store dash direction so it doesn't follow player
  private dashStartTime: number = 0
  private dashCooldownStartTime: number = 0
  private showTrail: boolean = false



  SetDefaults(): void {
    this.health = 8000
    this.speed = 60
    this.damage = 50
    this.sides = 12
    this.radius = 80
    this.color = this.defaultColor
    this.scoreChance = 1
    this.speedCap = 1
    this.isBoss = true
    this.knockbackResistance = 1
    this.barWidth = 60
    this.barHeight = 8
    this.scale = 1.0
    this.doOldPositionTracking = true
    this.doOldRotationTracking = true
    this.oldTrackingCounter = 1
    this.oldTrackingInterval = 100
  }

  AI(_playerX: number, _playerY: number): void {
    const now = this.scene.time.now

    // spawn animation
    if (this.spawnStartTime === 0) {
      // Start animation on first frame
      this.spawnStartTime = now
      this.spawnAnimation()
    }

    // spawn invincibility (time-based: 1000ms = 1 second)
    const spawnElapsed = now - this.spawnStartTime
    if (spawnElapsed < this.spawnImmunityDuration) {
      this.invincible = true
    } else {
      this.invincible = false
    }

    if (this.phase === 1)
    {
      this.PhaseOne(_playerX, _playerY)
    }
    else
    {

    }
  }

  PhaseOne(_playerX: number, _playerY: number): void 
  {
    const now = this.scene.time.now
    
    // Initialize phase start time on first call
    if (this.phaseStartTime === 0) {
      this.phaseStartTime = now
    }

    // Check if phase duration has elapsed (time-based, not frame-based)
    const phaseElapsed = now - this.phaseStartTime
    
    if (this.phaseStyle === 0)
    {
      this.moveTowards(_playerX, _playerY)
      if (phaseElapsed >= this.phaseDuration)  // 6000ms = 6 seconds (frame-rate independent)
      {
        console.log(`Phase transition at ${phaseElapsed}ms (expected ${this.phaseDuration}ms)`)
        this.phaseStyle = 1
        this.phaseStartTime = now  // Reset timer for dash phase
        this.dashCount = 0
      }
    }
    else if (this.phaseStyle === 1) // dash towards player
    {
      if (this.dashCount >= 3)
      {
        this.phaseStyle = 0
        this.phaseStartTime = now  // Reset timer for move phase
        this.dashCount = 0
      }
      if (!this.dashing && this.dashCount < 3 && this.dashCooldownStartTime === 0) // START DASH
      {
        this.dashing = true
        this.showTrail = true
        this.dashStartTime = now
        // Calculate dash direction ONCE when starting dash (fixed direction)
        this.dashDirection = Phaser.Math.Angle.Between(this.x, this.y, _playerX, _playerY)
      }
      if (this.dashing && this.dashCount < 3) // DASH
      {
        // Use the pre-calculated dash direction
        this.velocityX = Math.cos(this.dashDirection) * this.dashSpeed
        this.velocityY = Math.sin(this.dashDirection) * this.dashSpeed
        this.rotation = this.dashDirection + Math.PI / 2

        const dashElapsed = now - this.dashStartTime
        if (dashElapsed >= this.dashDuration)
        {
          this.dashing = false
          this.showTrail = false
          this.dashCount++
          this.dashCooldownStartTime = now
          this.velocityX = 0
          this.velocityY = 0
        }
      }
      if (!this.dashing && this.dashCooldownStartTime > 0 && this.dashCount < 3)
      {
        const cooldownElapsed = now - this.dashCooldownStartTime
        if (cooldownElapsed >= this.dashCooldownDuration)
        {
          this.dashCooldownStartTime = 0
        }
          this.velocityX = 0
          this.velocityY = 0
      }
    }
  }

  OnHit(_damage: number, _source: any): boolean {

    // *** invincibility frames *** //
    if (this.invincible) {
      console.log(`Dodecahedron ${this.id} is invincible and ignored damage.`)
      return false
    }
    else{
      // *** hit animatiion *** //

      // Cancel previous hit timer if still active
      if (this.hitColorTimer) {
        this.hitColorTimer.remove()
      }

      // Flash hit color
      this.color = this.hitColor
      this.hitColorTimer = this.scene.time.delayedCall(100, () => {
        this.color = this.defaultColor
        this.hitColorTimer = null
      })
    }
    return true
  }

  private spawnAnimation(): void {
    // Animate scale from spawn size back to normal
    this.scene.tweens.add({
      targets: this.container,
      scale: {
        from: this.spawnScale,
        to: 1.0,
      },
      duration: this.spawnImmunityDuration, // Use time-based duration in milliseconds
      ease: 'Quad.easeOut',
    })

    // Animate color from white to default using a helper object
    const colorTween = { progress: 0 }
    this.scene.tweens.add({
      targets: colorTween,
      progress: 1,
      duration: this.spawnImmunityDuration, // Use time-based duration in milliseconds
      ease: 'Quad.easeOut',
      onUpdate: () => {
        // Interpolate between white (0xffffff) and default color
        this.color = Phaser.Display.Color.Interpolate.ColorWithColor(
          new Phaser.Display.Color(0xff, 0xff, 0xff),
          Phaser.Display.Color.HexStringToColor('#' + this.GetDefaults().color.toString(16).padStart(6, '0')),
          1,
          colorTween.progress
        ).color
      },
    })
  }

  PostDraw(): void {
      if (this.showTrail && this.oldPositionX.length > 0) {
        const textureKey = TextureGenerator.getOrCreatePolygon(this.scene, {
          radius: this.radius,
          sides: this.sides,
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
          rotations: this.oldRotations,
          textureKey,
          tint: this.color,
          maxAlpha: 0.1,
          duration: 500,
          scale: this.scale,
          scaleDecay: true,
          minScale: 0.3
        })
      }
    }

  private GetDefaults() {
    return { color: 0x8a2be2 }
  }
}