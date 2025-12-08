import { Enemy } from './Enemy'

/**
 * Basic triangle enemy - weak and fast.
 */
export class Triangle extends Enemy {
  SetDefaults(): void {
    this.health = 30
    this.speed = 80
    this.damage = 5
    this.sides = 3
    this.radius = 15
    this.color = 0xff3333
    this.scoreChance = 0.1
  }
}
