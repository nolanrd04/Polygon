// import Phaser from 'phaser'
import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'

/**
 * Spinner projectile - AOE spin attack around the player.
 * Damages all enemies within radius.
 */
export class Spinner extends Projectile {
  /** Radius of the spin attack */
  radius: number = 80

  /** How long the spin lasts */
  spinDuration: number = 500

  /** Number of spinning lines */
  lineCount: number = 6

  private spinRotation: number = 0

  SetDefaults(): void {
    this.damage = 20
    this.speed = 0 // Centered on player
    this.size = this.radius
    this.pierce = 999 // Hits all enemies in radius
    this.color = COLORS.player
    this.timeLeft = this.spinDuration
  }

  Draw(): void {
    this.graphics.clear()
    this.graphics.lineStyle(3, this.color, 0.7)

    // Draw spinning lines
    for (let i = 0; i < this.lineCount; i++) {
      const angle = this.spinRotation + (Math.PI * 2 / this.lineCount) * i
      this.graphics.beginPath()
      this.graphics.moveTo(0, 0)
      this.graphics.lineTo(
        Math.cos(angle) * this.radius,
        Math.sin(angle) * this.radius
      )
      this.graphics.strokePath()
    }

    // Outer circle
    this.graphics.lineStyle(1, this.color, 0.3)
    this.graphics.strokeCircle(0, 0, this.radius)
  }

  AI(): void {
    // Rotate the spinner
    this.spinRotation += 0.3

    // Redraw with new rotation
    this.Draw()

    // Stay in place (would follow player position in update)
    this.velocityX = 0
    this.velocityY = 0
  }

  /** Update position to follow player */
  followPlayer(playerX: number, playerY: number): void {
    if (this.container) {
      this.container.x = playerX
      this.container.y = playerY
      this.positionX = playerX
      this.positionY = playerY
    }
  }
}
