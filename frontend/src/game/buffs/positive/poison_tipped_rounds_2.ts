import { Buff, type BuffDef, type BuffHost } from '../Buff'
import { BuffID, BuffHostID, RarityID, BuffStatID, IconID } from '../../data/ID'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { Poison2Def } from '../debuffs/poison2'

export const PoisonTippedRounds2Def: BuffDef = {
  id: BuffID.PoisonTippedRounds2,
  name: 'Poison Tipped Rounds 2',
  rarity: RarityID.Uncommon,
  description: 'Bullets will poison enemies',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  maxDuration: 6000,
  color: 0x51f542,
  icon: IconID.PoisonTippedRounds,
  dotOnHit: { buff: BuffID.Poison2, fraction: 0.03, duration: 6000 },
}

export class PoisonTippedRounds2 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the poison back up to its full duration instead of piling on.
  onProjectileHit(projectile: Projectile, target: BuffHost): void {
    const { buff, fraction, duration } = PoisonTippedRounds2Def.dotOnHit!
    const baseDmg = -Poison2Def.stats!.find(e => e.stat === BuffStatID.LifeRegen)!.value
    const poisonTick = Math.max(baseDmg, projectile.damage * fraction)
    target.AddBuff(buff, duration, { stacking: false, stats: {[BuffStatID.LifeRegen]: -poisonTick} })
  }
}