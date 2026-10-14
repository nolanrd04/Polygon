import { Buff, type BuffDef, type BuffHost } from '../Buff'
import { BuffID, BuffHostID, RarityID, BuffStatID, IconID } from '../../data/ID'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { Poison4Def } from '../debuffs/poison4'

export const PoisonTippedRounds4Def: BuffDef = {
  id: BuffID.PoisonTippedRounds4,
  name: 'Poison Tipped Rounds 4',
  rarity: RarityID.Epic,
  description: 'Bullets will poison enemies',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  maxDuration: 8000,
  color: 0x51f542,
  icon: IconID.PoisonTippedRounds,
}

export class PoisonTippedRounds4 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the poison back up to 5 s instead of piling on.
  onProjectileHit(_projectile: Projectile, target: BuffHost): void {
    const baseDmg = -Poison4Def.stats![0].value
    const poisonTick = Math.max(baseDmg, _projectile.damage * 0.03)
    target.AddBuff(BuffID.Poison4, 8000, { stacking: false, stats: {[BuffStatID.LifeRegen]: -poisonTick} })
  }
}