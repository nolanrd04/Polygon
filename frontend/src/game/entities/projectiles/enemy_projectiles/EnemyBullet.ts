import { Projectile } from '../Projectile'
import { TrailRenderer } from '../../../utils/TrailRenderer'
import { TextureGenerator } from '../../../utils/TextureGenerator'
import { Particle, SparkParticle } from '../../particles'

export class EnemyBullet extends Projectile {

  SetDefaults(): void {
    this.damage = 10
    this.speed = 400
    this.size = 5
    this.pierce = 1
    this.color = 0xFF0000
    this.timeLeft = 3000 // milliseconds
    this.doOldPositionTracking = true
    this.oldTrackingCounter = 4
    this.oldTrackingInterval = 20
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
        maxAlpha: 0.5,
        duration: 0,
        scale: 1.0,
        scaleDecay: true
      })
    }
  }

  onHit(): void {
    Particle.Burst(SparkParticle, this.positionX, this.positionY, Phaser.Math.Between(3, 5), {
          randomAngle: true,
          speed: 120,
          speedVariance: 0.2,
          color: this.color,
          timeLeft: 300,
          scale: 1,
          radius: 1.5
        })
    // Enemy bullets do not pierce, so destroy on hit
    this._destroy()
  }
}