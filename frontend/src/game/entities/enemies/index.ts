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
import { SuperTriangle } from './SuperTriangle'
import { Octogon } from './Octogon'
import { SuperSquare } from './SuperSquare'
import { SuperPentagon } from './SuperPentagon'
import { SuperHexagon } from './SuperHexagon'

// bosses
import { Dodecahedron } from './Dodecahedron'
// import { Exploder } from './Exploder'
import { ArrowHeadHead, ArrowHeadBody, ArrowHeadTail, ARROW_HEAD_IDS } from './ArrowHead'
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
  { id: 'super_triangle', class: SuperTriangle },
  { id: 'octogon', class: Octogon },
  { id: 'dodecahedron', class: Dodecahedron },
  { id: 'super_square', class: SuperSquare },
  { id: 'super_pentagon', class: SuperPentagon },
  { id: 'super_hexagon', class: SuperHexagon },
  // { id: 'exploder', class: Exploder },

  // Arrow Head boss. The head is the only one a wave ever spawns directly -
  // it spawns its own body/tail segments, which is why all three need to be
  // registered here. Ids come from the boss's own config so there is exactly
  // one place they are spelled out.
  { id: ARROW_HEAD_IDS.head, class: ArrowHeadHead },
  { id: ARROW_HEAD_IDS.body, class: ArrowHeadBody },
  { id: ARROW_HEAD_IDS.tail, class: ArrowHeadTail },
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
