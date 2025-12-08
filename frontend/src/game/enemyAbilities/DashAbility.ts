import Phaser from 'phaser'
import { Ability, AbilityConfig } from './Ability'
import { Enemy } from '../entities/enemies/Enemy'

export interface DashConfig extends AbilityConfig {
  cooldown: number
  dashSpeed: number
  dashDuration: number
  triggerDistance: number  // Distance to player that triggers dash
}

export const DEFAULT_DASH_CONFIG: DashConfig = {
  cooldown: 3000,
  dashSpeed: 400,
  dashDuration: 300,
  triggerDistance: 200
}

export class DashAbility extends Ability {
  private isDashing: boolean = false
  private dashEndTime: number = 0
  private dashAngle: number = 0

  constructor(scene: Phaser.Scene, enemy: Enemy, config?: Partial<DashConfig>) {
    super(scene, enemy, { ...DEFAULT_DASH_CONFIG, ...config })
  }

  update(playerX: number, playerY: number): void {
    const config = this.config as DashConfig

    // Check if currently dashing
    if (this.isDashing) {
      if (this.scene.time.now >= this.dashEndTime) {
        this.isDashing = false
      } else {
        // Continue dash
        this.enemy.body.setVelocity(
          Math.cos(this.dashAngle) * config.dashSpeed,
          Math.sin(this.dashAngle) * config.dashSpeed
        )
        return
      }
    }

    // Check if should start dash
    if (!this.canUse()) return

    const distance = Phaser.Math.Distance.Between(
      this.enemy.x,
      this.enemy.y,
      playerX,
      playerY
    )

    if (distance <= config.triggerDistance) {
      this.startDash(playerX, playerY)
    }
  }

  private startDash(playerX: number, playerY: number): void {
    const config = this.config as DashConfig

    this.markUsed()
    this.isDashing = true
    this.dashEndTime = this.scene.time.now + config.dashDuration
    this.dashAngle = Phaser.Math.Angle.Between(
      this.enemy.x,
      this.enemy.y,
      playerX,
      playerY
    )

    // Visual feedback - brief color flash
    // (handled by enemy's drawPolygonWithColor if needed)
  }

  onDeath(): void {
    // Nothing special on death
  }
}
