export { Ability } from './Ability'
export type { AbilityConfig } from './Ability'
export { DashAbility, DEFAULT_DASH_CONFIG } from './DashAbility'
export type { DashConfig } from './DashAbility'
export { ExplodeAbility, DEFAULT_EXPLODE_CONFIG } from './ExplodeAbility'
export type { ExplodeConfig } from './ExplodeAbility'
export { SplitAbility, DEFAULT_SPLIT_CONFIG } from './SplitAbility'
export type { SplitConfig } from './SplitAbility'
export { ShootAbility, DEFAULT_SHOOT_CONFIG } from './ShootAbility'
export type { ShootConfig } from './ShootAbility'
export { ShieldAbility, DEFAULT_SHIELD_CONFIG } from './ShieldAbility'
export type { ShieldConfig } from './ShieldAbility'

import { Ability } from './Ability'
import { DashAbility } from './DashAbility'
import { ExplodeAbility } from './ExplodeAbility'
import { SplitAbility } from './SplitAbility'
import { ShootAbility } from './ShootAbility'
import { ShieldAbility } from './ShieldAbility'
import { Enemy } from '../entities/enemies/Enemy'
import Phaser from 'phaser'

export type AbilityType = 'dash' | 'explode' | 'split' | 'shoot' | 'shield'

export function createAbility(
  type: AbilityType,
  scene: Phaser.Scene,
  enemy: Enemy
): Ability {
  switch (type) {
    case 'dash':
      return new DashAbility(scene, enemy)
    case 'explode':
      return new ExplodeAbility(scene, enemy)
    case 'split':
      return new SplitAbility(scene, enemy)
    case 'shoot':
      return new ShootAbility(scene, enemy)
    case 'shield':
      return new ShieldAbility(scene, enemy)
    default:
      throw new Error(`Unknown ability type: ${type}`)
  }
}
