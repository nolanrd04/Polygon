import { Projectile } from '../Projectile'
import { TextureGenerator } from '../../../utils/TextureGenerator'
import { Particle, SmokeParticle, SparkParticle } from '../../particles'
import { LightingSystem } from '../../../../game/systems/LightingSystem'
import { LightingIntensityID } from '../../../data/ID'

export class AcidExplosion extends Projectile {
  private expansionTime: number = 0
  private maxExpansionTime: number = 200 // milliseconds
  private currentRadius: number = 0
  private maxRadius: number = 40
  private particleTimer: number = 0

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

  OnSpawn(): void {

        Particle.Burst(SparkParticle, this.positionX, this.positionY, Phaser.Math.Between(8, 12), {
          randomAngle: true,
          speed: 200,
          speedVariance: 0.2,
          color: this.color,
          timeLeft: 300,
          scale: 0.75,
          radius: Phaser.Math.Between(2.5, 3.5),
          additive: true,
        })
      }

  /**
   * Override PreDraw to replace sprite with semi-transparent explosion texture
   */
  PreDraw(): boolean {
    // First time: replace sprite with semi-transparent explosion texture
    // Check for default bullet texture (fillAlpha=1.0) by looking for pattern _fffffff_1_s
    // const currentKey = this.sprite.texture.key
    // console.log('AcidExplosion texture key:', currentKey)

    if (this.sprite.texture.key.startsWith('circle_') && this.sprite.texture.key.includes('_fffffff_1_s')) {
      // console.log('Replacing texture...')
      const textureKey = TextureGenerator.getOrCreateCircle(this.scene, {
        radius: this.size,
        fillColor: 0xffffff,
        fillAlpha: 0.5  // Single semi-transparent circle, no glow
      })
      // console.log('New texture key:', textureKey)

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
    if (this.spawnTime === 0) {
      this.spawnTime = this.scene.time.now
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
    // incremented before spawning dust because the projectile grows in size first
    this.particleTimer++
    let color = this.color
    if (Phaser.Math.Between(0, 1) === 0) {
      color = 0xFFFFFF
    }
    if (this.particleTimer % 10 === 0) {

      for (let i = 0; i < Phaser.Math.Between(1, 3); i++) {

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = this.size * Math.sqrt(Phaser.Math.FloatBetween(0, 1))
      const offsetX = Math.cos(angle) * dist
      const offsetY = Math.sin(angle) * dist

      Particle.NewParticle(SmokeParticle, this.positionX + offsetX, this.positionY + offsetY,
        0,
        0,
        {
          color: color,
          timeLeft: 300,
          scale: 1,
          radius: Phaser.Math.Between(2.5, 7),
          additive: true,
        })
      }
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
    const elapsedMs = currentTime - this.spawnTime
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

  PostDraw(): void {
    // Grows in with the blast and fades out with the sprite. Scaled off maxRadius
    // rather than currentRadius so the light is sized like every other explosion
    // (intensity is the only reach control - see LightingSystem).
    const expansion = Phaser.Math.Clamp(this.currentRadius / this.maxRadius, 0, 1)
    LightingSystem.AddLight(
      this.positionX,
      this.positionY,
      this.color,
      LightingIntensityID.Explosion * (this.maxRadius / 20) * expansion * this.sprite.alpha
    )
  }
}
