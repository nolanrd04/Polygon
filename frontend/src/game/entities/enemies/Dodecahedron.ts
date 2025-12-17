import { Enemy } from './Enemy'

export class Dodecahedron extends Enemy {
  SetDefaults(): void {
    this.health = 30000
    this.speed = 60
    this.damage = 150
    this.sides = 12
    this.radius = 80
    this.color = 0x8a2be2
    this.scoreChance = 1
    this.speedCap = 1
    this.isBoss = true
    this.knockbackResistance = 1
  }
}