import Phaser from 'phaser'
import { Particle } from './Particle'

export class PolygonParticle extends Particle {
  SetDefaults(): void {
    this.sides = 3
    this.radius = 10
    this.color = 0xffffff
    this.timeLeft = 400
    this.fadeOutTime = 400
    this.friction = 0.1
  }

  OnSpawn(): void {
    this.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
    this.rotationVelocity = Phaser.Math.FloatBetween(-8, 8)
  }
}