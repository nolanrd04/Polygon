import { Buff, type BuffDef, type BuffHost } from '../Buff'
import { BuffID, BuffHostID, RarityID, BuffStatID, IconID } from '../../data/ID'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { OnFire3Def } from '../debuffs/on_fire_3'

export const BurningBullets3Def: BuffDef = {
  id: BuffID.BurningBullets3,
  name: 'Burning Bullets 3',
  rarity: RarityID.Rare,
  description: 'Bullets will set enemies on fire',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  maxDuration: 7000,
  color: 0xff7a1a,
  icon: IconID.BurningBullets,
  dotOnHit: { buff: BuffID.OnFire3, fraction: 0.05, duration: 7000 },
}

export class BurningBullets3 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the burn back up to its full duration instead of piling on.
  onProjectileHit(projectile: Projectile, target: BuffHost): void {
    const { buff, fraction, duration } = BurningBullets3Def.dotOnHit!
    const baseDmg = -OnFire3Def.stats!.find(e => e.stat === BuffStatID.LifeRegen)!.value
    const burnTick = Math.max(baseDmg, projectile.damage * fraction)
    target.AddBuff(buff, duration, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
  }
}