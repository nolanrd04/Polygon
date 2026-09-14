import { Enemy } from './Enemy'
import { LightingSystem } from '../../systems/LightingSystem'
import { LightingIntensityID, SoundID } from '../../data/ID'
import { TrailRenderer } from '../../utils/TrailRenderer'
import { TextureGenerator } from '../../utils/TextureGenerator'
import { AcidExplosion } from '../projectiles/enemy_projectiles/AcidExplosion'
import { getDefaultVolume } from '../../../game/core/AudioRegistry'
import { Particle, SparkParticle } from '../particles'

export class SeekingSquare extends Enemy {

  /** Max heading change in radians per second. Lower = wider turning circle. */
  turnRate: number = Math.PI * 0.5

  /**
   * Direction of travel, tracked separately from velocityX/Y.
   *
   * Knockback OVERWRITES velocity with a vector pointing away from the player
   * (CollisionManager aims it projectile -> enemy), so reading the heading back
   * out of velocity would hand the square a reversed heading on every hit and
   * make it fly a full 180 arc to recover. Owning the heading here means a hit
   * displaces the square without ever changing which way it is pointed.
   *
   * null until the first moveTowards, so it starts facing the player instead of
   * atan2(0, 0) === 0 (due east).
   */
  heading: number | null = null
  particleTimer: number = 0

  SetDefaults(): void {
    this.health = 200
    this.speed = 300
    this.damage = 30
    this.sides = 4
    this.radius = 12
    this.color = 0x33ff33
    this.scoreChance = 0
    this.speedCap = 1
    this.knockbackResistance = 0.9
    this.doOldPositionTracking = true
    this.doOldRotationTracking = true
    this.oldTrackingCounter = 5
    this.oldTrackingInterval = 50
    this.collideWithEnemies = false  // Pass through other enemies - no barge or separation. See Enemy.collideWithEnemies.
    // bundle drop prevention logic in Super Octogon class
  }

  AI(): void {
    if (this.particleTimer % 15 === 0){
      Particle.NewParticle(SparkParticle, this.x + Phaser.Math.Between(-this.radius, this.radius), this.y + Phaser.Math.Between(-this.radius, this.radius),
        0, 
        0, 
        {
          color: 0xffffff,
          timeLeft: 300,
          scale: 1,
          radius: Phaser.Math.Between(2.5, 3.5),
          additive: true,
        })
    }
    this.particleTimer++
  }

  /**
   * Constant-speed pursuit with a clamped turn rate: speed never changes, only
   * the direction, and the direction can move at most turnRate rad/sec. Gives a
   * missile-like turning circle instead of the instant snap a velocity lerp has.
   */
  moveTowards(targetX: number, targetY: number): void {
    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)

    if (this.heading === null) {
      this.heading = targetAngle
    }

    // RotateTo steps toward the target by at most this amount, shortest way
    // around, and snaps once it is within range.
    const maxTurn = this.turnRate * (this.scene.game.loop.delta / 1000)
    this.heading = Phaser.Math.Angle.RotateTo(this.heading, targetAngle, maxTurn)

    this.velocityX = Math.cos(this.heading) * this.speed
    this.velocityY = Math.sin(this.heading) * this.speed

    // Heading is already rate-limited, so the sprite can track it exactly.
    this.rotation = this.heading + Math.PI / 2
  }

  OnDeath(): void {
    // Spawn acid explosion on death
    const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
    const explosion = new AcidExplosion()
    explosion.SetDefaults()
    
    // Scale explosion damage to match the bullet's scaled damage
    explosion.damage = this.damage

    // Spawn at death location, doesn't travel anywhere
    scene.spawnProjectile(explosion, this.x, this.y, 0, 0, 'enemy', this.id)
    // all sound calls should have this check to prevent "sound stacking"
        //
        if (this.scene.sound.isPlaying(SoundID.AcidBulletExplosion))
        {
          this.scene.sound.stopByKey(SoundID.AcidBulletExplosion)
        }
        this.scene.sound.play(SoundID.AcidBulletExplosion, { volume: getDefaultVolume(SoundID.AcidBulletExplosion) })
        //
  }
  

  /**
   * Emissive glow, sized to the enemy so bigger shapes light more of the room.
   *
   * Uses this.color, not a stored default: the damage flash tints the SPRITE and
   * leaves this.color alone (Enemy.takeDamage), so the light will not strobe white
   * on every hit.
   */
  PostDraw(): void {
    LightingSystem.AddLight(this.x, this.y, this.color, LightingIntensityID.Entity * this.radius / 35)

        if (this.doOldPositionTracking && this.oldPositionX.length > 0) {
          // Generate diamond trail texture (same as main sprite)
          const textureKey = TextureGenerator.getOrCreatePolygon(this.scene, {
            sides: this.sides,
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
  }
}
