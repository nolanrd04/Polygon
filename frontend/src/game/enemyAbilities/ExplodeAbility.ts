import Phaser from 'phaser'
import { Ability, AbilityConfig } from './Ability'
import { Enemy } from '../entities/enemies/Enemy'
import { EventBus } from '../core/EventBus'

export interface ExplodeConfig extends AbilityConfig {
  cooldown: number  // Not really used for explode
  explosionRadius: number
  explosionDamage: number
}

export const DEFAULT_EXPLODE_CONFIG: ExplodeConfig = {
  cooldown: 0,
  explosionRadius: 80,
  explosionDamage: 25
}

export class ExplodeAbility extends Ability {
  constructor(scene: Phaser.Scene, enemy: Enemy, config?: Partial<ExplodeConfig>) {
    super(scene, enemy, { ...DEFAULT_EXPLODE_CONFIG, ...config })
  }

  update(_playerX: number, _playerY: number): void {
    // Explode ability only triggers on death, no update logic
  }

  onDeath(): void {
    const config = this.config as ExplodeConfig

    // Create explosion visual
    const graphics = this.scene.add.graphics()
    const x = this.enemy.x
    const y = this.enemy.y

    // Expanding circle effect
    let radius = 10
    const maxRadius = config.explosionRadius

    const expandTimer = this.scene.time.addEvent({
      delay: 16,
      callback: () => {
        graphics.clear()

        // Outer ring
        graphics.lineStyle(3, 0xff6600, 1 - radius / maxRadius)
        graphics.strokeCircle(x, y, radius)

        // Inner fill
        graphics.fillStyle(0xff4400, 0.3 * (1 - radius / maxRadius))
        graphics.fillCircle(x, y, radius)

        radius += 8

        if (radius >= maxRadius) {
          expandTimer.destroy()
          graphics.destroy()
        }
      },
      loop: true
    })

    // Emit explosion event for collision detection
    EventBus.emit('enemy-explode', {
      x,
      y,
      radius: config.explosionRadius,
      damage: config.explosionDamage
    })
  }
}
