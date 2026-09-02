import { Enemy } from './Enemy'
import { LightingSystem } from '../../systems/LightingSystem'
import { LightingIntensityID } from '../../data/ID'

/**
 * Square enemy - balanced stats.
 */
export class Square extends Enemy {
  SetDefaults(): void {
    this.health = 200
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
