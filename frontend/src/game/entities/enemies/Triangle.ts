import { Enemy } from './Enemy'

/**
 * Basic triangle enemy - weak and fast.
 */
export class Triangle extends Enemy {
  SetDefaults(): void {
    this.health = 100
    this.speed = 100
    this.damage = 35
    this.sides = 3
    this.radius = 15
    this.color = 0xff3333
    this.scoreChance = 0.3
    this.speedCap = 2.5  // Capped at 1.5x (already fast)
  }
}
