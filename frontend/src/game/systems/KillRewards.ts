import { GameManager } from '../core/GameManager'
import { UpgradeSystem } from './upgrades'
import { waveValidation } from '../services/WaveValidation'
import type { Enemy } from '../entities/enemies/Enemy'

/**
 * Everything a player-credited kill awards. Shared by projectile hits
 * (CollisionManager) and debuff damage (MainScene's buff tick), so a burn
 * kill counts exactly like a bullet kill.
 */
export function awardPlayerKill(enemy: Enemy): void {
  // Award kill counter (blocked internally if player is dead)
  GameManager.addKill()

  // Award 1 point based on scoreChance (0 to 1)
  // NOTE: Points continue after death for testing/fun
  if (Math.random() < enemy.scoreChance) {
    GameManager.addPoints(1)
    waveValidation.recordPointsEarned(1)
  }

  // On-kill upgrade hooks (explode on kill, etc.)
  UpgradeSystem.dispatchOnEnemyKilled(enemy)

  // Let the enemy decide how many bundles drop and their rarities
  enemy.DropBundles()
}