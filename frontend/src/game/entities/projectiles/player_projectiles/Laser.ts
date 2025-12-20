// import Phaser from 'phaser'
import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'

/**
 * Laser projectile - instant hitscan beam.
 * Unlike regular projectiles, this is drawn as a line and hits instantly.
 */
export class Laser extends Projectile {
  /** How far the laser reaches */
  range: number = 1000

  /** Thickness of the beam */
  thickness: number = 3

  SetDefaults(): void {
    this.damage = 15
    this.speed = 0 // Instant, doesn't move
    this.size = 3
    this.pierce = 999 // Pierces everything
    this.color = COLORS.laser
    this.timeLeft = 100 // Visual duration only
  }


  AI(): void {
    // Laser doesn't move - it's instant
    this.velocityX = 0
    this.velocityY = 0
  }
}
