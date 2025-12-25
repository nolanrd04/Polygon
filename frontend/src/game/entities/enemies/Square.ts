import { Enemy } from './Enemy'

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
    this.speedCap = 4.5
    this.knockbackResistance = 0.9
  }
}
