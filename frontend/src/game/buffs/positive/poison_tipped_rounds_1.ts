import { Buff, type BuffDef, type BuffHost } from '../Buff'
import { BuffID, BuffHostID, RarityID, BuffStatID, IconID } from '../../data/ID'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { Poison1Def } from '../debuffs/poison1'

export const PoisonTippedRounds1Def: BuffDef = {
  id: BuffID.PoisonTippedRounds1,
  name: 'Poison Tipped Rounds 1',
  rarity: RarityID.Common,
  description: 'Bullets will poison enemies',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  maxDuration: 5000,
  color: 0x51f542,
  icon: IconID.PoisonTippedRounds,
  dotOnHit: { buff: BuffID.Poison1, fraction: 0.03, duration: 5000 },
}

export class PoisonTippedRounds1 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the poison back up to its full duration instead of piling on.
  onProjectileHit(projectile: Projectile, target: BuffHost): void {
    const { buff, fraction, duration } = PoisonTippedRounds1Def.dotOnHit!
    const baseDmg = -Poison1Def.stats!.find(e => e.stat === BuffStatID.LifeRegen)!.value
    const poisonTick = Math.max(baseDmg, projectile.damage * fraction)
    target.AddBuff(buff, duration, { stacking: false, stats: {[BuffStatID.LifeRegen]: -poisonTick} })
  }
}