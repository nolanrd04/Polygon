import { Buff, type BuffDef, type BuffHost } from '../Buff'
import { BuffID, BuffHostID, RarityID, BuffStatID, IconID } from '../../data/ID'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { OnFire4Def } from '../debuffs/on_fire_4'

export const BurningBullets4Def: BuffDef = {
  id: BuffID.BurningBullets4,
  name: 'Burning Bullets 4',
  rarity: RarityID.Epic,
  description: 'Bullets will set enemies on fire',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  maxDuration: 8000,
  color: 0xff7a1a,
  icon: IconID.BurningBullets,
}

export class BurningBullets4 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the burn back up to 8 s instead of piling on.
  onProjectileHit(_projectile: Projectile, target: BuffHost): void {
    const baseDmg = -OnFire4Def.stats![0].value
    const burnTick = Math.max(baseDmg, _projectile.damage * 0.05)
    target.AddBuff(BuffID.OnFire4, 8000, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
  }
}