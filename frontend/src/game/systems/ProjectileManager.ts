import Phaser from 'phaser'
import { Projectile } from '../entities/projectiles/Projectile'
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../core/GameConfig'

export class ProjectileManager {
  private scene: Phaser.Scene
  private projectiles: Phaser.GameObjects.Group

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.projectiles = scene.add.group()
  }

  // This manager is no longer needed since Player.ts handles projectile firing directly
  // Keeping it for legacy compatibility but marking as deprecated

  fireLaser(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    stats: Record<string, number>
  ): void {
    // Laser is instant - implemented as a raycast line
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY)
    const distance = 1000
    const endX = x + Math.cos(angle) * distance
    const endY = y + Math.sin(angle) * distance

    // Draw laser beam
    const graphics = this.scene.add.graphics()
    graphics.lineStyle(stats.thickness || 3, COLORS.laser, 1)
    graphics.beginPath()
    graphics.moveTo(x, y)
    graphics.lineTo(endX, endY)
    graphics.strokePath()

    // Glow effect
    graphics.lineStyle((stats.thickness || 3) * 3, COLORS.laser, 0.3)
    graphics.beginPath()
    graphics.moveTo(x, y)
    graphics.lineTo(endX, endY)
    graphics.strokePath()

    // Fade out
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 100,
      onComplete: () => graphics.destroy()
    })

    // Store laser data for collision detection
    // This would be handled by CollisionManager
  }

  fireZapper(
    x: number,
    y: number,
    _targetX: number,
    _targetY: number,
    _stats: Record<string, number>
  ): void {
    // Chain lightning - implementation would find nearest enemies and chain
    const graphics = this.scene.add.graphics()
    graphics.lineStyle(2, COLORS.zapper, 1)

    // Visual placeholder - actual chaining logic in CollisionManager
    graphics.beginPath()
    graphics.moveTo(x, y)
    // Chain points would be calculated based on nearby enemies

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 200,
      onComplete: () => graphics.destroy()
    })
  }

  activateFlamer(
    x: number,
    y: number,
    angle: number,
    stats: Record<string, number>
  ): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics()
    const range = stats.range || 100
    const spread = stats.spread || 0.5

    // Draw cone
    graphics.fillStyle(COLORS.flamer, 0.5)
    graphics.beginPath()
    graphics.moveTo(x, y)
    graphics.arc(x, y, range, angle - spread, angle + spread)
    graphics.closePath()
    graphics.fillPath()

    return graphics
  }

  activateSpinner(
    x: number,
    y: number,
    radius: number,
    duration: number
  ): void {
    const graphics = this.scene.add.graphics()

    // Spinning effect
    let rotation = 0
    const spinTimer = this.scene.time.addEvent({
      delay: 16,
      callback: () => {
        graphics.clear()
        graphics.lineStyle(3, COLORS.player, 0.7)

        // Draw spinning lines
        for (let i = 0; i < 6; i++) {
          const angle = rotation + (Math.PI * 2 / 6) * i
          graphics.beginPath()
          graphics.moveTo(x, y)
          graphics.lineTo(
            x + Math.cos(angle) * radius,
            y + Math.sin(angle) * radius
          )
          graphics.strokePath()
        }

        rotation += 0.3
      },
      loop: true
    })

    this.scene.time.delayedCall(duration, () => {
      spinTimer.destroy()
      graphics.destroy()
    })
  }

  update(): void {
    // Player.ts now manages its own projectiles
    // This is kept for legacy compatibility
  }

  getProjectiles(): Phaser.GameObjects.Group {
    return this.projectiles
  }

  clear(): void {
    this.projectiles.clear(true, true)
  }
}
