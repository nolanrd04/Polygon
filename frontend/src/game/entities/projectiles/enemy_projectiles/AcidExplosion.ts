import { Projectile } from '../Projectile'

export class AcidExplosion extends Projectile {
  private expansionTime: number = 0
  private maxExpansionTime: number = 200 // milliseconds
  private currentRadius: number = 0
  private maxRadius: number = 40
  private spawnTimeMs: number = 0

  SetDefaults(): void {
    this.damage = 12
    this.speed = 0 // Stationary explosion
    this.size = 5 // Base size, will expand
    this.pierce = 999 // Very high so it doesn't get destroyed by pierce limit
    this.color = 0x00FF00
    this.timeLeft = 4000 // Exists for 4 seconds
    this.hitEnemyCooldown = 100 // Can hit player again after 100ms
    this.canCutTiles = true
  }

  AI(): void {
    // Track spawn time on first frame
    if (this.spawnTimeMs === 0) {
      this.spawnTimeMs = this.scene.time.now
    }

    // Expand from center over time
    this.expansionTime += 16.67 // roughly 60fps delta
    
    if (this.expansionTime < this.maxExpansionTime) {
      const expansionProgress = this.expansionTime / this.maxExpansionTime
      this.currentRadius = this.maxRadius * expansionProgress
      
      // Update physics hitbox as it expands
      this.body.setCircle(this.currentRadius)
      this.body.setOffset(-this.currentRadius, -this.currentRadius)
    } else {
      this.currentRadius = this.maxRadius
    }
  }

  Draw(): void {
    this.graphics.clear()

    // Calculate fade alpha for last 500ms of lifetime
    const alpha = this.calculateFadeAlpha()

    // Draw expanding explosion circle
    this.graphics.fillStyle(this.color, 0.6 * alpha)
    this.graphics.beginPath()
    this.graphics.arc(0, 0, this.currentRadius, 0, Math.PI * 2)
    this.graphics.fillPath()

    // Draw outer ring
    this.graphics.lineStyle(2, this.color, 0.8 * alpha)
    this.graphics.beginPath()
    this.graphics.arc(0, 0, this.currentRadius, 0, Math.PI * 2)
    this.graphics.strokePath()
  }

  private calculateFadeAlpha(): number {
    // Calculate time elapsed since spawn
    const currentTime = this.scene.time.now
    const elapsedMs = currentTime - this.spawnTimeMs
    const timeRemaining = this.timeLeft - elapsedMs
    
    // Fade out during last 500ms
    if (timeRemaining <= 500 && timeRemaining > 0) {
      return Math.max(0, timeRemaining / 500) // 1.0 -> 0.0 over 500ms
    }
    return 1.0 // Fully opaque until last 500ms
  }

  OnHitNPC(_enemy: any): boolean {
    // Always return true to prevent being destroyed on hit
    return true
  }
}
