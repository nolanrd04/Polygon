import { Projectile } from '../Projectile'

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
}