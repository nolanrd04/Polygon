import { Enemy } from './Enemy'
import { AcidBullet } from '../projectiles/enemy_projectiles/AcidBullet' 

/**
 * Square enemy - balanced stats.
 */
export class ActivatedSquare extends Enemy {

  private lastFireTime: number = 0
  private fireCooldown: number = 3000 

  SetDefaults(): void {
    this.health = 120
    this.speed = 90
    this.damage = 75
    this.sides = 4
    this.radius = 20
    this.color = 0x33ff33
    this.scoreChance = 0.5
    this.speedCap = 2.45  // Normal cap (2x)
  }

  AI(_playerX: number, _playerY: number): void {
    const now = this.scene.time.now
    if (now - this.lastFireTime >= this.fireCooldown) {
        this.lastFireTime = now
        // Create and spawn projectile using centralized method
        const projectile = new AcidBullet()
        projectile.SetDefaults()
        // Scale damage based on enemy's damage stat
        projectile.damage = this.damage
        
        const scene = this.scene as any
        scene.spawnProjectile(projectile, this.x, this.y, _playerX, _playerY, 'enemy', this.id)
    }
  }

  Draw(): void {
    this.graphics.clear()

    // Calculate square vertices
    const vertices: Phaser.Math.Vector2[] = []
    const angleStep = (Math.PI * 2) / this.sides

    for (let i = 0; i < this.sides; i++) {
      const angle = angleStep * i - Math.PI / 2
      vertices.push(new Phaser.Math.Vector2(
        Math.cos(angle) * this.radius,
        Math.sin(angle) * this.radius
      ))
    }

    // Draw inner square (normal)
    this.graphics.fillStyle(this.color, 1)
    this.graphics.lineStyle(2, 0xffffff, 0.5)

    this.graphics.beginPath()
    this.graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      this.graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    this.graphics.closePath()
    this.graphics.fillPath()
    this.graphics.strokePath()

    // Draw outer perimeter with space
    const outerRadius = this.radius + 6
    const outerVertices: Phaser.Math.Vector2[] = []

    for (let i = 0; i < this.sides; i++) {
      const angle = angleStep * i - Math.PI / 2
      outerVertices.push(new Phaser.Math.Vector2(
        Math.cos(angle) * outerRadius,
        Math.sin(angle) * outerRadius
      ))
    }

    this.graphics.lineStyle(1.5, 0xffffff, 0.8)
    this.graphics.beginPath()
    this.graphics.moveTo(outerVertices[0].x, outerVertices[0].y)
    for (let i = 1; i < outerVertices.length; i++) {
      this.graphics.lineTo(outerVertices[i].x, outerVertices[i].y)
    }
    this.graphics.closePath()
    this.graphics.strokePath()
  }
}
