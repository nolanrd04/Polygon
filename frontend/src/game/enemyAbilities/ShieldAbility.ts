import Phaser from 'phaser'
import { Ability, AbilityConfig } from './Ability'
import { Enemy } from '../entities/enemies/Enemy'

export interface ShieldConfig extends AbilityConfig {
  cooldown: number        // Time between shield activations
  shieldDuration: number  // How long shield lasts
  shieldHealth: number    // Damage shield can absorb (0 = invincible)
}

export const DEFAULT_SHIELD_CONFIG: ShieldConfig = {
  cooldown: 5000,
  shieldDuration: 2000,
  shieldHealth: 0  // Invincible while active
}

export class ShieldAbility extends Ability {
  private isShielded: boolean = false
  private shieldEndTime: number = 0
  private graphics: Phaser.GameObjects.Graphics | null = null
  private currentShieldHealth: number = 0

  constructor(scene: Phaser.Scene, enemy: Enemy, config?: Partial<ShieldConfig>) {
    super(scene, enemy, { ...DEFAULT_SHIELD_CONFIG, ...config })
  }

  update(_playerX: number, _playerY: number): void {
    // Check if shield should end
    if (this.isShielded && this.scene.time.now >= this.shieldEndTime) {
      this.deactivateShield()
    }

    // Try to activate shield
    if (!this.isShielded && this.canUse()) {
      this.activateShield()
    }

    // Update shield visual position
    if (this.isShielded && this.graphics) {
      this.updateShieldVisual()
    }
  }

  private activateShield(): void {
    const config = this.config as ShieldConfig

    this.markUsed()
    this.isShielded = true
    this.shieldEndTime = this.scene.time.now + config.shieldDuration
    this.currentShieldHealth = config.shieldHealth

    this.graphics = this.scene.add.graphics()
    this.updateShieldVisual()
  }

  private deactivateShield(): void {
    this.isShielded = false
    if (this.graphics) {
      this.graphics.destroy()
      this.graphics = null
    }
  }

  private updateShieldVisual(): void {
    if (!this.graphics) return

    this.graphics.clear()

    const radius = this.enemy.radius + 10

    // Shield bubble
    this.graphics.lineStyle(3, 0x00ffff, 0.8)
    this.graphics.strokeCircle(this.enemy.x, this.enemy.y, radius)

    // Inner glow
    this.graphics.fillStyle(0x00ffff, 0.2)
    this.graphics.fillCircle(this.enemy.x, this.enemy.y, radius)

    // Hexagonal pattern overlay
    this.graphics.lineStyle(1, 0x00ffff, 0.3)
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i
      const x1 = this.enemy.x + Math.cos(angle) * radius * 0.5
      const y1 = this.enemy.y + Math.sin(angle) * radius * 0.5
      const x2 = this.enemy.x + Math.cos(angle) * radius
      const y2 = this.enemy.y + Math.sin(angle) * radius
      this.graphics.beginPath()
      this.graphics.moveTo(x1, y1)
      this.graphics.lineTo(x2, y2)
      this.graphics.strokePath()
    }
  }

  // Returns true if damage was blocked
  absorbDamage(amount: number): boolean {
    if (!this.isShielded) return false

    const config = this.config as ShieldConfig

    // Invincible shield
    if (config.shieldHealth === 0) {
      return true
    }

    // Absorb damage
    this.currentShieldHealth -= amount
    if (this.currentShieldHealth <= 0) {
      this.deactivateShield()
    }

    return true
  }

  isActive(): boolean {
    return this.isShielded
  }

  onDeath(): void {
    this.deactivateShield()
  }
}
