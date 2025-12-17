import Phaser from 'phaser'
import { Enemy } from './Enemy'
import { EnemyBullet } from '../projectiles/enemy_projectiles/EnemyBullet'

export class Shooter extends Enemy {
  private lastFireTime: number = 0
  private fireCooldown: number = 1000 // milliseconds

  SetDefaults(): void {
    this.health = 45
    this.speed = 50
    this.damage = 20
    this.sides = 3
    this.radius = 15
    this.color = 0x4287f5
    this.scoreChance = 0.5
    this.speedCap = 1.5  // Capped at 1.5x (already fast)
  }

  Draw(): void {
    // Call parent Draw to render the polygon
    super.Draw()

    // Add a "head" indicator (front vertex marker) so player knows which way it faces
    // const _angleStep = (Math.PI * 2) / this.sides
    const angle = -Math.PI / 2 // First vertex (top)
    const headX = Math.cos(angle) * this.radius
    const headY = Math.sin(angle) * this.radius

    // Draw head indicator
    const graphics = this.getContainer().list[0] as Phaser.GameObjects.Graphics
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(headX, headY, 4)
  }

  AI(_playerX: number, _playerY: number): void {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, _playerX, _playerY)

    if (distance > 400) {
      // Too far - move closer (base class already calls moveTowards, but we can adjust if needed)
    } else {
      // In range - stop moving and shoot
      this.velocityX = 0
      this.velocityY = 0

      // Check fire cooldown
      const now = this.scene.time.now
      if (now - this.lastFireTime >= this.fireCooldown) {
        this.lastFireTime = now

        // Create and spawn projectile using centralized method
        const projectile = new EnemyBullet()
        projectile.SetDefaults()
        // Scale damage based on enemy's damage stat
        projectile.damage = this.damage
        // console.log(`Shooter spawning projectile with damage: ${projectile.damage} (enemy damage: ${this.damage})`)

        const scene = this.scene as any
        scene.spawnProjectile(projectile, this.x, this.y, _playerX, _playerY, 'enemy', this.id)
      }
    }
  }
}