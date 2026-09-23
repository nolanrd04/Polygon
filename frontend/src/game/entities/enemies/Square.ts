import { Enemy } from './Enemy'
import { FIXED_STEP_MS } from '../../core/GameConfig'
import { LightingSystem } from '../../systems/LightingSystem'
import { LightingIntensityID } from '../../data/ID'
import { Particle } from '../particles'
import { SparkParticle } from '../particles'

/**
 * Square enemy - balanced stats.
 */
export class Square extends Enemy {
  /** Fraction of max health regained per second while fleeing below 50%. */
  private static readonly HEAL_PER_SECOND = 0.3

  private particleTimer: number = 0
  SetDefaults(): void {
    this.health = 150
    this.speed = 80
    this.damage = 75
    this.sides = 4
    this.radius = 20
    this.color = 0x33ff33
    this.scoreChance = 0.4
    this.speedCap = 6.5
    this.knockbackResistance = 0.9
    this.bundleDropChance = 0.0 // use difficulty drop chance
  }

  moveTowards(targetX: number, targetY: number): void 
  {
    // normal movement if the square is above 50% health, otherwise it will move away from the player and heal
    if (this.health >= this.maxHealth * 0.5)
    {
      super.moveTowards(targetX, targetY)
      return
    }
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

  AI(_playerX: number, _playerY: number): void
  {
    if (this.health >= this.maxHealth * 0.5)
    {
      super.AI(_playerX, _playerY)
      return
    }

    if (this.particleTimer % 4 === 0)
    {
      const velX = Phaser.Math.Between(-50, 50)
      const velY = Phaser.Math.Between(-50, 50)
      Particle.NewParticle(SparkParticle, this.x, this.y, velX, velY, 
        {
        color: 0x33ff33,
      })

      // Heal a little bit
      // not depend on how fast the logic loop happens to run.
      const healAmount = this.maxHealth * Square.HEAL_PER_SECOND * (FIXED_STEP_MS / 1000)
      this.health = Math.min(this.health + healAmount, this.maxHealth)
    }
    this.particleTimer++
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
  }
}
