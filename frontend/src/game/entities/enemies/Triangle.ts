import { Enemy } from './Enemy'
import { LightingSystem } from '../../systems/LightingSystem'
import { LightingRadiusID } from '../../data/ID'

/**
 * Basic triangle enemy - weak and fast.
 */
export class Triangle extends Enemy {
  SetDefaults(): void {
    this.health = 70
    this.speed = 100
    this.damage = 35
    this.sides = 3
    this.radius = 15
    this.color = 0xff3333
    this.scoreChance = 0.3
    this.speedCap = 6.5
    this.hitboxSize = 0.8  // Smaller hitbox for triangles (easier to dodge)
    this.bundleDropChance = 0.0 // use difficulty drop chance
  }

  /**
   * Triangles give off a faint red light, so a group of them reads as a glow
   * approaching before the shapes themselves resolve out of the dark.
   *
   * Emitted from PostDraw rather than AI so it still runs while the enemy is
   * knocked back or otherwise skipping its AI hook.
   */
  PostDraw(): void {
    LightingSystem.AddLight(this.x, this.y, this.color, 2, LightingRadiusID.PlayerRadius)
  }
}
