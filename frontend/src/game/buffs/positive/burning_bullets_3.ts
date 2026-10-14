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
}

export class BurningBullets3 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the burn back up to 7 s instead of piling on.
  onProjectileHit(_projectile: Projectile, target: BuffHost): void {
    const baseDmg = -OnFire3Def.stats![0].value
    const burnTick = Math.max(baseDmg, _projectile.damage * 0.05)
    target.AddBuff(BuffID.OnFire3, 7000, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
  }
}