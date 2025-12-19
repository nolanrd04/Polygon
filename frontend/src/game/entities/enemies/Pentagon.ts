import { Enemy } from './Enemy'


export class Pentagon extends Enemy {
  SetDefaults(): void {
    this.health = 250
    this.speed = 63
    this.damage = 80
    this.sides = 5
    this.radius = 20
    this.color = 0xff44ff
    // this.color = 0xff8b1f
    this.scoreChance = 0.5
    this.speedCap = 2.5  // Higher cap (dangerous)
  }
}
