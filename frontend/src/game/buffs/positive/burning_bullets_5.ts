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
}

export class BurningBullets5 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the burn back up to 10 s instead of piling on.
  onProjectileHit(_projectile: Projectile, target: BuffHost): void {
    const baseDmg = -OnFire5Def.stats![0].value
    const burnTick = Math.max(baseDmg, _projectile.damage * 0.05)
    target.AddBuff(BuffID.OnFire5, 9000, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
  }
}