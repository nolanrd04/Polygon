import Phaser from 'phaser'
import { Enemy } from '../entities/enemies/Enemy'

export interface AbilityConfig {
  cooldown: number
  [key: string]: number | string | boolean | undefined
}

export abstract class Ability {
  protected scene: Phaser.Scene
  protected enemy: Enemy
  protected config: AbilityConfig
  protected lastUseTime: number = 0

  constructor(scene: Phaser.Scene, enemy: Enemy, config: AbilityConfig) {
    this.scene = scene
    this.enemy = enemy
    this.config = config
  }

  canUse(): boolean {
    const now = this.scene.time.now
    return now - this.lastUseTime >= this.config.cooldown
  }

  protected markUsed(): void {
    this.lastUseTime = this.scene.time.now
  }

  abstract update(playerX: number, playerY: number): void
  abstract onDeath?(): void
}
