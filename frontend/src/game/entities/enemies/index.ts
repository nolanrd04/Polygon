/**
 * Enemy Registry
 *
 * To add a new enemy type:
 * 1. Create your enemy class that extends Enemy
 * 2. Import it below
 * 3. Add it to the ENEMY_TYPES array
 *
 * That's it! The EnemyManager will automatically have access to it.
 */

export { Enemy } from './Enemy'
import { Triangle } from './Triangle'
import { Square } from './Square'
import { Diamond } from './Diamond'
import { Pentagon } from './Pentagon'
import { Hexagon } from './Hexagon'
// import { Dasher } from './Dasher'
import { Shooter } from './Shooter'
// import { Exploder } from './Exploder'
import type { Enemy } from './Enemy'

export type EnemyType = {
  id: string
  class: new () => Enemy
}

/**
 * Central registry of all enemy types.
 * Add new enemies here - they'll be automatically available in the game.
 */
export const ENEMY_TYPES: EnemyType[] = [
  { id: 'triangle', class: Triangle },
  { id: 'square', class: Square },
  { id: 'diamond', class: Diamond },
  { id: 'pentagon', class: Pentagon },
  { id: 'hexagon', class: Hexagon },
  // { id: 'dasher', class: Dasher },
  { id: 'shooter', class: Shooter }
  // { id: 'exploder', class: Exploder },
]

/**
 * Get the enemy registry as a map for quick lookups.
 */
export function getEnemyRegistry(): Record<string, new () => Enemy> {
  const registry: Record<string, new () => Enemy> = {}
  for (const enemy of ENEMY_TYPES) {
    registry[enemy.id] = enemy.class
  }
  return registry
}
