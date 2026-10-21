/** Available attack/projectile types */
export type AttackType = 'bullet' | 'laser' | 'zapper' | 'flamer' | 'spinner' | 'healer' | 'controller'  | 'plagueBringer'

/** Info about each attack type for the UI */
export const ATTACK_INFO: Record<AttackType, {
  name: string
  description: string
}> = {
  bullet: {
    name: 'Bullet',
    description: 'Rapid-fire projectiles with a variety of upgrade potential.'
  },
  laser: {
    name: 'Laser',
    description: 'Instant hitscan beam that pierces through enemies.'
  },
  zapper: {
    name: 'Zapper',
    description: 'Chain lightning that jumps between nearby enemies.'
  },
  flamer: {
    name: 'Flamer',
    description: 'Continuous cone of fire for close-range crowd control.'
  },
  spinner: {
    name: 'Spinner',
    description: 'Spin your polygon to damage all nearby enemies.'
  },
  healer: {
    name: 'Healer',
    description: 'Heal yourself and allies with special attacks.'
  },
  controller: {
    name: 'Controller',
    description: 'Control drones to attack enemies automatically.'
  },
  plagueBringer: {
    name: 'Plague Bringer',
    description: 'Spread disease to enemies, causing varying damage and debuffs over time.'
  }
}
