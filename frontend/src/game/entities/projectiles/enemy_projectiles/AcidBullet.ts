import { Projectile } from '../Projectile'
import { AcidExplosion } from './AcidExplosion'
import { TrailRenderer } from '../../../utils/TrailRenderer'
import { TextureGenerator } from '../../../utils/TextureGenerator'

export class AcidBullet extends Projectile {
  SetDefaults(): void {
    this.damage = 8
    this.speed = 200
    this.size = 8
    this.pierce = 1
    this.color = 0x00FF00
    this.timeLeft = Math.random() * 2000 + 1000 // milliseconds
    this.doOldPositionTracking = true
    this.oldTrackingCounter = 6
    this.oldTrackingInterval = 45
  }

  /**
   * Render sprite trail using old positions
   */
  PostDraw(): void {
    if (this.doOldPositionTracking && this.oldPositionX.length > 0) {
      // Generate trail texture on-demand
      const textureKey = TextureGenerator.getOrCreateCircle(this.scene, {
        radius: this.size,
        fillColor: 0xffffff,
        fillAlpha: 1.0,
        glowRadius: this.size * 0.5,
        glowAlpha: 0.3
      })

      const positions = this.oldPositionX.map((x, i) => ({
        x,
        y: this.oldPositionY[i]
      }))

      TrailRenderer.renderTrail(this.scene, {
        positions,
        textureKey,
        tint: this.color,
        maxAlpha: 0.6,
        duration: 0,
        scale: 1.0,
        scaleDecay: true
      })
    }
  }

  OnKill(): void {
    // Spawn acid explosion on death
    const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
    const explosion = new AcidExplosion()
    explosion.SetDefaults()
    
    // Scale explosion damage to match the bullet's scaled damage
    explosion.damage = this.damage

    // Spawn at death location, doesn't travel anywhere
    scene.spawnProjectile(explosion, this.positionX, this.positionY, this.positionX, this.positionY, 'enemy', this.ownerId)
  }
}
