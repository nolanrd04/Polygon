import { Buff, type BuffDef, type BuffHost } from '../Buff'
import { BuffID, BuffHostID, RarityID, BuffStatID, IconID } from '../../data/ID'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { OnFire2Def } from '../debuffs/on_fire_2'

export const BurningBullets2Def: BuffDef = {
  id: BuffID.BurningBullets2,
  name: 'Burning Bullets 2',
  rarity: RarityID.Uncommon,
  description: 'Bullets will set enemies on fire',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  maxDuration: 6000,
  color: 0xff7a1a,
  icon: IconID.BurningBullets,
  dotOnHit: { buff: BuffID.OnFire2, fraction: 0.05, duration: 6000 },
}

export class BurningBullets2 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the burn back up to its full duration instead of piling on.
  onProjectileHit(projectile: Projectile, target: BuffHost): void {
    const { buff, fraction, duration } = BurningBullets2Def.dotOnHit!
    const baseDmg = -OnFire2Def.stats!.find(e => e.stat === BuffStatID.LifeRegen)!.value
    const burnTick = Math.max(baseDmg, projectile.damage * fraction)
    target.AddBuff(buff, duration, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
  }
}