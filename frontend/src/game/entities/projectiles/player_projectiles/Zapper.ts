// import Phaser from 'phaser'
import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'

/**
 * Zapper projectile - chain lightning that jumps between enemies.
 * This is more of an effect than a traditional projectile.
 */
export class Zapper extends Projectile {
  /** How many enemies it can chain to */
  chainCount: number = 3

  /** Maximum distance to chain to next enemy */
  chainRange: number = 150

  /** Damage reduction per chain (0.8 = 80% of previous damage) */
  damageDecay: number = 0.8

  private chainPoints: { x: number; y: number }[] = []

  SetDefaults(): void {
    this.damage = 12
    this.speed = 0 // Instant
    this.size = 2
    this.pierce = 0
    this.color = COLORS.zapper
    this.timeLeft = 200 // Visual duration
    this.usesCustomRendering = true // Enable Graphics API for chain lightning
  }


  /** Set the chain points for drawing (called by collision system) */
  setChainPoints(points: { x: number; y: number }[]): void {
    this.chainPoints = points
    if (this.graphics) {
      this.graphics.clear()
      this.Draw()
    }
  }

  /** Draw the chain lightning effect */
  Draw(): void {
    if (!this.graphics || this.chainPoints.length === 0) return

    this.graphics.clear()
    this.graphics.lineStyle(2, this.color, 1)

    // Draw lines connecting all chain points
    for (let i = 0; i < this.chainPoints.length - 1; i++) {
      const start = this.chainPoints[i]
      const end = this.chainPoints[i + 1]

      // Convert world coordinates to local container coordinates
      const localStartX = start.x - this.positionX
      const localStartY = start.y - this.positionY
      const localEndX = end.x - this.positionX
      const localEndY = end.y - this.positionY

      this.graphics.beginPath()
      this.graphics.moveTo(localStartX, localStartY)
      this.graphics.lineTo(localEndX, localEndY)
      this.graphics.strokePath()
    }
  }

  AI(): void {
    this.velocityX = 0
    this.velocityY = 0
  }
}
