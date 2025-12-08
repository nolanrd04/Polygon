import Phaser from 'phaser'
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

  Draw(): void {
    // Laser is drawn differently - as a line from origin to range
    // The line is drawn in world space, not local space
    const endX = Math.cos(this.rotation) * this.range
    const endY = Math.sin(this.rotation) * this.range

    // Main beam
    this.graphics.lineStyle(this.thickness, this.color, 1)
    this.graphics.beginPath()
    this.graphics.moveTo(0, 0)
    this.graphics.lineTo(endX, endY)
    this.graphics.strokePath()

    // Glow effect
    this.graphics.lineStyle(this.thickness * 3, this.color, 0.3)
    this.graphics.beginPath()
    this.graphics.moveTo(0, 0)
    this.graphics.lineTo(endX, endY)
    this.graphics.strokePath()
  }

  AI(): void {
    // Laser doesn't move - it's instant
    this.velocityX = 0
    this.velocityY = 0
  }
}
