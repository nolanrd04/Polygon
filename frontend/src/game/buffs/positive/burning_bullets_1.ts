import { Buff, type BuffDef, type BuffHost } from '../Buff'
import { BuffID, BuffHostID, RarityID, BuffStatID, IconID } from '../../data/ID'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { OnFire1Def } from '../debuffs/on_fire_1'

export const BurningBullets1Def: BuffDef = {
  id: BuffID.BurningBullets1,
  name: 'Burning Bullets 1',
  rarity: RarityID.Common,
  description: 'Bullets will set enemies on fire',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  maxDuration: 5000,
  icon: IconID.BurningBullets,
  color: 0xff7a1a,
  dotOnHit: { buff: BuffID.OnFire1, fraction: 0.05, duration: 5000 },
}

export class BurningBullets1 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the burn back up to its full duration instead of piling on.
  onProjectileHit(projectile: Projectile, target: BuffHost): void {
    const { buff, fraction, duration } = BurningBullets1Def.dotOnHit!
    const baseDmg = -OnFire1Def.stats!.find(e => e.stat === BuffStatID.LifeRegen)!.value
    const burnTick = Math.max(baseDmg, projectile.damage * fraction)
    target.AddBuff(buff, duration, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
  }
}