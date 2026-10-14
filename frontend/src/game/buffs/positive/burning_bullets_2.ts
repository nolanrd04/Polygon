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
}

export class BurningBullets2 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the burn back up to 6 s instead of piling on.
  onProjectileHit(_projectile: Projectile, target: BuffHost): void {
    const baseDmg = -OnFire2Def.stats![0].value
    const burnTick = Math.max(baseDmg, _projectile.damage * 0.05)
    target.AddBuff(BuffID.OnFire2, 6000, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
  }
}