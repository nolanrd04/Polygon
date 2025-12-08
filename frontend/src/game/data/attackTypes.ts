/** Available attack/projectile types */
export type AttackType = 'bullet' | 'laser' | 'zapper' | 'flamer' | 'spinner'

/** Info about each attack type for the UI */
export const ATTACK_INFO: Record<AttackType, {
  name: string
  description: string
}> = {
  bullet: {
    name: 'Bullet',
    description: 'Rapid-fire projectiles with upgrade potential for multishot and pierce.'
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
  }
}
