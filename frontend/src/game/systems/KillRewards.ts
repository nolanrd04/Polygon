import { GameManager } from '../core/GameManager'
import { EventBus } from '../core/EventBus'
import { UpgradeSystem } from './upgrades'
import { waveValidation } from '../services/WaveValidation'
import type { Enemy } from '../entities/enemies/Enemy'

/**
 * Everything a player-credited kill awards. Shared by projectile hits
 * (CollisionManager), debuff damage (MainScene's buff tick) and thorns, so
 * every kill counts exactly like a bullet kill.
 */
export function awardPlayerKill(killed: Enemy): void {
  const enemy = killed.rewardTarget

  // Award kill counter (blocked internally if player is dead)
  GameManager.addKill()

  // NOTE: Fragments continue after death for testing/fun
  if (enemy.fragments) {
    GameManager.addFragments(enemy.fragments)
    waveValidation.recordFragmentsEarned(enemy.fragments)
    EventBus.emit('fragments-awarded', { x: enemy.x, y: enemy.y, counts: enemy.fragments })
  }

  // On-kill upgrade hooks (explode on kill, etc.)
  UpgradeSystem.dispatchOnEnemyKilled(enemy)

  // Let the enemy decide how many bundles drop and their rarities
  enemy.DropBundles()
}