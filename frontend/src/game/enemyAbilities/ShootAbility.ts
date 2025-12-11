import Phaser from 'phaser'
import { Ability, AbilityConfig } from './Ability'
import { Enemy } from '../entities/enemies/Enemy'
import { EventBus } from '../core/EventBus'

export interface ShootConfig extends AbilityConfig {
  cooldown: number
  projectileDamage: number
  projectileSpeed: number
  range: number
}

export const DEFAULT_SHOOT_CONFIG: ShootConfig = {
  cooldown: 2000,
  projectileDamage: 10,
  projectileSpeed: 200,
  range: 300
}

export class ShootAbility extends Ability {
  constructor(scene: Phaser.Scene, enemy: Enemy, config?: Partial<ShootConfig>) {
    super(scene, enemy, { ...DEFAULT_SHOOT_CONFIG, ...config })
  }

  update(playerX: number, playerY: number): void {
    if (!this.canUse()) return

    const config = this.config as ShootConfig
    const distance = Phaser.Math.Distance.Between(
      this.enemy.x,
      this.enemy.y,
      playerX,
      playerY
    )

    // Only shoot if player is in range
    if (distance > config.range) return

    this.shoot(playerX, playerY)
  }

  private shoot(playerX: number, playerY: number): void {
    const config = this.config as ShootConfig
    this.markUsed()

    // Emit event for ProjectileManager to create enemy projectile
    EventBus.emit('enemy-shoot', {
      x: this.enemy.x,
      y: this.enemy.y,
      targetX: playerX,
      targetY: playerY,
      damage: config.projectileDamage,
      speed: config.projectileSpeed,
      color: this.enemy.color
    })

    // Visual feedback - muzzle flash
    const graphics = this.scene.add.graphics()
    graphics.fillStyle(this.enemy.color, 0.8)

    const angle = Phaser.Math.Angle.Between(
      this.enemy.x,
      this.enemy.y,
      playerX,
      playerY
    )
    const flashX = this.enemy.x + Math.cos(angle) * this.enemy.radius
    const flashY = this.enemy.y + Math.sin(angle) * this.enemy.radius

    graphics.fillCircle(flashX, flashY, 8)

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 100,
      onComplete: () => graphics.destroy()
    })
  }

  onDeath(): void {
    // Nothing special
  }
}
