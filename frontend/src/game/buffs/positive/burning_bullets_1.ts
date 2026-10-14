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
}

export class BurningBullets1 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the burn back up to 5 s instead of piling on.
  onProjectileHit(_projectile: Projectile, target: BuffHost): void {
    const baseDmg = -OnFire1Def.stats![0].value
    const burnTick = Math.max(baseDmg, _projectile.damage * 0.05)
    target.AddBuff(BuffID.OnFire1, 5000, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
  }
}