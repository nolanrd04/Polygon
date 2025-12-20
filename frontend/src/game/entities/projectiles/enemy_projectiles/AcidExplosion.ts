import { Projectile } from '../Projectile'
import { TextureGenerator } from '../../../utils/TextureGenerator'

export class AcidExplosion extends Projectile {
  private expansionTime: number = 0
  private maxExpansionTime: number = 200 // milliseconds
  private currentRadius: number = 0
  private maxRadius: number = 40
  private spawnTimeMs: number = 0

  SetDefaults(): void {
    this.damage = 12
    this.speed = 0 // Stationary explosion
    this.size = 40 // Base size for semi-transparent explosion
    this.pierce = 999 // Very high so it doesn't get destroyed by pierce limit
    this.color = 0x00FF00
    this.timeLeft = 4000 // Exists for 4 seconds
    this.hitEnemyCooldown = 100 // Can hit player again after 100ms
    this.canCutTiles = true
  }

  /**
   * Override PreDraw to replace sprite with semi-transparent explosion texture
   */
  PreDraw(): boolean {
    // First time: replace sprite with semi-transparent explosion texture
    if (this.sprite.texture.key.startsWith('circle_') && !this.sprite.texture.key.includes('_0.3')) {
      const textureKey = TextureGenerator.getOrCreateCircle(this.scene, {
        radius: this.size,
        fillColor: 0xffffff,
        fillAlpha: 0.3,  // Semi-transparent
        glowRadius: this.size * 0.2,
        glowAlpha: 0.15
      })

      const oldSprite = this.sprite
      this.sprite = this.scene.add.sprite(0, 0, textureKey)
      this.sprite.setTint(this.color)
      this.sprite.setScale(TextureGenerator.getDisplayScale())  // Scale down high-res texture
      this.container.add(this.sprite)
      oldSprite.destroy()
    }

    return true
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

  /**
   * Update sprite scale to match expanding radius
   */
  Draw(): void {

    // Update sprite scale to match expanding radius
    // Sprite size is based on this.size, need to scale to currentRadius
    const targetScale = (this.currentRadius / this.size) * TextureGenerator.getDisplayScale()
    this.sprite.setScale(targetScale)

    // Update alpha for fade out
    this.sprite.setAlpha(this.calculateFadeAlpha())
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
