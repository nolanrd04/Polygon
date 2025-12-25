import { Enemy } from './Enemy'


export class Pentagon extends Enemy {
  SetDefaults(): void {
    this.health = 550
    this.speed = 63
    this.damage = 80
    this.sides = 5
    this.radius = 20
    this.color = 0xff44ff
    // this.color = 0xff8b1f
    this.scoreChance = 0.5
    this.speedCap = 4.5
    this.knockbackResistance = 0.8
  }
}
