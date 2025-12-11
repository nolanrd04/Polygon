import { Enemy } from './Enemy'

/**
 * Square enemy - balanced stats.
 */
export class Square extends Enemy {
  SetDefaults(): void {
    this.health = 175
    this.speed = 80
    this.damage = 75
    this.sides = 4
    this.radius = 20
    this.color = 0x33ff33
    this.scoreChance = 0.4
    this.speedCap = 2.25  // Normal cap (2x)
  }
}
