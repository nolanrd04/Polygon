import { Buff, type BuffDef, type BuffHost } from '../Buff'
import { BuffID, BuffHostID, RarityID, BuffStatID, IconID } from '../../data/ID'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { OnFire5Def } from '../debuffs/on_fire_5'

export const BurningBullets5Def: BuffDef = {
  id: BuffID.BurningBullets5,
  name: 'Burning Bullets 5',
  rarity: RarityID.Legendary,
  description: 'Bullets will set enemies on fire',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  maxDuration: 10000,
  color: 0xff7a1a,
  icon: IconID.BurningBullets,
  dotOnHit: { buff: BuffID.OnFire5, fraction: 0.05, duration: 9000 },
}

export class BurningBullets5 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the burn back up to its full duration instead of piling on.
  onProjectileHit(projectile: Projectile, target: BuffHost): void {
    const { buff, fraction, duration } = BurningBullets5Def.dotOnHit!
    const baseDmg = -OnFire5Def.stats!.find(e => e.stat === BuffStatID.LifeRegen)!.value
    const burnTick = Math.max(baseDmg, projectile.damage * fraction)
    target.AddBuff(buff, duration, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
  }
}