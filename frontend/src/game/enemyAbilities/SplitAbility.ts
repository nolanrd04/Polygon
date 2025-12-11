import { Ability, AbilityConfig } from './Ability'
import { Enemy } from '../entities/enemies/Enemy'
import { EventBus } from '../core/EventBus'
import Phaser from 'phaser'

export interface SplitConfig extends AbilityConfig {
  cooldown: number  // Not used for split
  splitCount: number
  childHealthPercent: number
  childSizePercent: number
}

export const DEFAULT_SPLIT_CONFIG: SplitConfig = {
  cooldown: 0,
  splitCount: 2,
  childHealthPercent: 0.4,
  childSizePercent: 0.6
}

export class SplitAbility extends Ability {
  constructor(scene: Phaser.Scene, enemy: Enemy, config?: Partial<SplitConfig>) {
    super(scene, enemy, { ...DEFAULT_SPLIT_CONFIG, ...config })
  }

  update(_playerX: number, _playerY: number): void {
    // Split ability only triggers on death
  }

  onDeath(): void {
    const config = this.config as SplitConfig

    // Don't split if enemy is already too small
    if (this.enemy.radius < 10) return

    const childConfig = {
      health: Math.floor(this.enemy.health * config.childHealthPercent),
      radius: Math.floor(this.enemy.radius * config.childSizePercent),
      speed: this.enemy.speed,
      damage: this.enemy.damage,
      sides: this.enemy.sides,
      color: this.enemy.color,
      scoreChance: this.enemy.scoreChance
    }

    // Spawn children in a spread pattern
    const angleStep = (Math.PI * 2) / config.splitCount
    const spawnDistance = this.enemy.radius + childConfig.radius + 5

    for (let i = 0; i < config.splitCount; i++) {
      const angle = angleStep * i + Math.random() * 0.5
      const spawnX = this.enemy.x + Math.cos(angle) * spawnDistance
      const spawnY = this.enemy.y + Math.sin(angle) * spawnDistance

      // Emit event for EnemyManager to spawn the child
      EventBus.emit('enemy-split', {
        x: spawnX,
        y: spawnY,
        config: childConfig,
        velocityAngle: angle
      })
    }
  }
}
