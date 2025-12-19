import { Projectile } from '../Projectile'
import { AcidExplosion } from './AcidExplosion'

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

  

  Draw(): void {
    this.graphics.clear()

    // Draw trail effect at old positions
    if (this.doOldPositionTracking && this.oldPositionX.length > 0) {
      // Draw fading circles along the trail
      for (let i = 0; i < this.oldPositionX.length; i++) {
        const opacity = ((i + 1) / this.oldPositionX.length) * 0.3  // Max 30% opacity
        
        // Calculate offset in world space
        let offsetX = this.oldPositionX[i] - this.positionX
        let offsetY = this.oldPositionY[i] - this.positionY

        // Reverse-rotate the offset to compensate for container rotation
        const cos = Math.cos(-this.rotation)
        const sin = Math.sin(-this.rotation)
        const rotatedOffsetX = offsetX * cos - offsetY * sin
        const rotatedOffsetY = offsetX * sin + offsetY * cos

        const radiusScale = i * 0.15 + 0.75 // Smaller circles for older positions
        this.graphics.fillStyle(this.color, opacity)
        this.graphics.beginPath()
        this.graphics.arc(rotatedOffsetX, rotatedOffsetY, this.size * radiusScale, 0, Math.PI * 2)
        this.graphics.fillPath()
      }
    }

    // Draw main circle (fully opaque) on top
    this.graphics.fillStyle(this.color, 1)
    this.graphics.beginPath()
    this.graphics.arc(0, 0, this.size, 0, Math.PI * 2)
    this.graphics.fillPath()
  }

  OnKill(): void {
    // Spawn acid explosion on death
    const scene = this.scene as any
    const explosion = new AcidExplosion()
    explosion.SetDefaults()
    
    // Spawn at death location, doesn't travel anywhere
    scene.spawnProjectile(explosion, this.positionX, this.positionY, this.positionX, this.positionY, 'enemy', this.ownerId)
  }
}
