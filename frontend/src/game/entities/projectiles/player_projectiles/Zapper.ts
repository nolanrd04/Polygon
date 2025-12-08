import Phaser from 'phaser'
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
  }

  Draw(): void {
    // Draw lightning bolts between chain points
    if (this.chainPoints.length < 2) {
      // Just draw a spark at origin
      this.graphics.fillStyle(this.color, 1)
      this.graphics.fillCircle(0, 0, 5)
      return
    }

    this.graphics.lineStyle(2, this.color, 1)

    for (let i = 0; i < this.chainPoints.length - 1; i++) {
      const start = this.chainPoints[i]
      const end = this.chainPoints[i + 1]

      // Draw jagged lightning line
      this.drawLightningBolt(
        start.x - this.positionX,
        start.y - this.positionY,
        end.x - this.positionX,
        end.y - this.positionY
      )
    }
  }

  private drawLightningBolt(x1: number, y1: number, x2: number, y2: number): void {
    const segments = 5
    const jitter = 10

    this.graphics.beginPath()
    this.graphics.moveTo(x1, y1)

    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const midX = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter
      const midY = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter
      this.graphics.lineTo(midX, midY)
    }

    this.graphics.lineTo(x2, y2)
    this.graphics.strokePath()

    // Glow
    this.graphics.lineStyle(6, this.color, 0.3)
    this.graphics.beginPath()
    this.graphics.moveTo(x1, y1)
    this.graphics.lineTo(x2, y2)
    this.graphics.strokePath()

    // Reset line style for next bolt
    this.graphics.lineStyle(2, this.color, 1)
  }

  /** Set the chain points for drawing (called by collision system) */
  setChainPoints(points: { x: number; y: number }[]): void {
    this.chainPoints = points
    this.graphics.clear()
    this.Draw()
  }

  AI(): void {
    this.velocityX = 0
    this.velocityY = 0
  }
}
