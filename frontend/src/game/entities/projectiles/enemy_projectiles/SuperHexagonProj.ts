import { Projectile } from '../Projectile'
import { TrailRenderer } from '../../../utils/TrailRenderer'
import { TextureGenerator } from '../../../utils/TextureGenerator'
import { Particle, StreakParticle } from '../../particles'

export class SuperHexagonProj extends Projectile {
  private particleTimer: number = 0
  SetDefaults(): void {
    this.damage = 8
    this.speed = 400
    this.size = 6
    this.pierce = 999999999
    this.color = 0xd622ac
    this.timeLeft = 2000
    this.doOldPositionTracking = true
    this.oldTrackingCounter = 4
    this.oldTrackingInterval = 55
    this.canCutTiles = true
  }

  AI(): void {

    
    if (this.particleTimer % 2 === 0) {
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
        maxAlpha: 0.6,
        duration: 0,
        scale: 1.0,
        scaleDecay: true
      })
    }
  }
}
