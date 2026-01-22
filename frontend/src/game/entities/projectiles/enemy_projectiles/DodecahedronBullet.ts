import { Projectile } from '../Projectile'
import { TrailRenderer } from '../../../utils/TrailRenderer'
import { TextureGenerator } from '../../../utils/TextureGenerator'

export class DodecahedronBullet extends Projectile {

  SetDefaults(): void {
    this.damage = 10
    this.speed = 400
    this.size = 10
    this.pierce = 999 // High pierce to allow passing through multiple obstacles
    this.color = 0x8a2be2
    this.timeLeft = 3000 // milliseconds
    this.doOldPositionTracking = true
    this.oldTrackingCounter = 4
    this.oldTrackingInterval = 20
    this.canCutTiles = true
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

}