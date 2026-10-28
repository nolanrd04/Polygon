import { Buff, type BuffDef, type BuffHost } from '../Buff'
import { BuffID, BuffHostID, RarityID, BuffStatID, IconID } from '../../data/ID'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { Poison3Def } from '../debuffs/poison3'

export const PoisonTippedRounds3Def: BuffDef = {
  id: BuffID.PoisonTippedRounds3,
  name: 'Poison Tipped Rounds 3',
  rarity: RarityID.Rare,
  description: 'Bullets will poison enemies',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  maxDuration: 7000,
  color: 0x51f542,
  icon: IconID.PoisonTippedRounds,
  dotOnHit: { buff: BuffID.Poison3, fraction: 0.03, duration: 7000 },
}

export class PoisonTippedRounds3 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  // Non-stacking here: each hit tops the poison back up to its full duration instead of piling on.
  onProjectileHit(projectile: Projectile, target: BuffHost): void {
    const { buff, fraction, duration } = PoisonTippedRounds3Def.dotOnHit!
    const baseDmg = -Poison3Def.stats!.find(e => e.stat === BuffStatID.LifeRegen)!.value
    const poisonTick = Math.max(baseDmg, projectile.damage * fraction)
    target.AddBuff(buff, duration, { stacking: false, stats: {[BuffStatID.LifeRegen]: -poisonTick} })
  }
}