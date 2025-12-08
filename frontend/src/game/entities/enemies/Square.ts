import { Enemy } from './Enemy'

/**
 * Square enemy - balanced stats.
 */
export class Square extends Enemy {
  SetDefaults(): void {
    this.health = 50
    this.speed = 60
    this.damage = 10
    this.sides = 4
    this.radius = 20
    this.color = 0x33ff33
    this.scoreChance = 0.15
  }
}
