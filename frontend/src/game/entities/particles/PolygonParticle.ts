import Phaser from 'phaser'
import { Particle } from './Particle'
import { LightingIntensityID } from '../../../game/data/ID'
import { LightingSystem } from '../../../game/systems/LightingSystem'

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

  PostDraw(): void {
    LightingSystem.AddLight(this.posX, this.posY, this.color, LightingIntensityID.Projectile * this.radius / 10 * this.sprite.alpha)
  }
}