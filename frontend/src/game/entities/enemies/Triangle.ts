import { Enemy } from './Enemy'

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
    this.speedCap = 4.5
    this.hitboxSize = 0.8  // Smaller hitbox for triangles (easier to dodge)
  }
}
