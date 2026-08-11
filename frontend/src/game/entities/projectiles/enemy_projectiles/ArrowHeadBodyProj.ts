import { Projectile } from '../Projectile'
import { TrailRenderer } from '../../../utils/TrailRenderer'
import { TextureGenerator } from '../../../utils/TextureGenerator'
import { Particle, SparkParticle, StreakParticle } from '../../particles'

export class ArrowHeadBodyProj extends Projectile {
    private particleTimer: number = 0

  SetDefaults(): void {
    this.damage = 10
    this.speed = 500
    this.size = 5
    this.pierce = 3
    this.color = 0xFF0000
    this.timeLeft = 3000 // milliseconds
    this.doOldPositionTracking = true
    this.oldTrackingCounter = 4
    this.oldTrackingInterval = 20
  }

  // This boss attack always ricochets off obstacles - no upgrade gating needed.
  OnObstacleCollide(obstacle?: Phaser.GameObjects.GameObject): boolean {
    if (obstacle) {
      this.ricochet(obstacle)
      return false
    }
    return true
  }

  AI(): void
  {
    this.rotation = Math.atan2(this.velocityY, this.velocityX)
    if (this.particleTimer % 2 === 0) 
    {
        const streak = Particle.NewParticlePerfect(StreakParticle, this.positionX, this.positionY, 0, 0, {
            timeLeft: 300,
            color: this.color,
            rotation: this.rotation
          })
          // 12px long, 3px thick. Pool returns null when full, so null-check.
        if (streak) streak.SetStreak(12, 2)
    }
    this.particleTimer++
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
  }
}