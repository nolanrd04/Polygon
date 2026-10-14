import Phaser from 'phaser'
import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'
import type { Enemy } from '../../entities/enemies/Enemy'
import type { Player } from '../../entities/Player'
import { Particle } from '../../entities/particles/Particle'
import { SparkParticle } from '../../entities/particles/BasicParticles'

// it is recommended for all damage over time debuffs to change the LifeRegen stat value on call to scale with player/enemy stats. For example:
//
// const baseDmg = -OnFire5Def.stats![0].value
// const burnTick = Math.max(baseDmg, _projectile.damage * 0.05)
// target.AddBuff(BuffID.OnFire5, 10000, { stacking: false, stats: {[BuffStatID.LifeRegen]: -burnTick} })
//
// This does NOT happen in the class itself, but in the class that calls the debuff application.
export const OnFire3Def: BuffDef = {
  id: BuffID.OnFire3,
  name: 'On Fire 3',
  rarity: RarityID.Rare,
  description: 'Burns for 5 HP/sec',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: true,
  maxDuration: 60000,
  color: 0xff7a1a,
  tintStrength: 0.4,
  icon: IconID.OnFire,
  stats: [{ stat: BuffStatID.LifeRegen, value: -5, isMultiplier: false }],
}

export class OnFire3 extends Buff {
  updateEnemy(enemy: Enemy): void {
    // A few embers a second, rising off the enemy's body.
    if (this.timeLeft % 6 !== 0) return
    const spread = enemy.radius * enemy.scale * 0.8
    Particle.NewParticle(
      SparkParticle,
      enemy.x + Phaser.Math.FloatBetween(-spread, spread),
      enemy.y + Phaser.Math.FloatBetween(-spread, spread),
      Phaser.Math.FloatBetween(-20, 20),
      Phaser.Math.FloatBetween(-90, -50),
      { color: this.def.color, radius: Phaser.Math.FloatBetween(1.5, 2.5) }
    )
  }

  updatePlayer(_player: Player): void 
  {
    // A few embers a second, rising off the player's body.
    if (this.timeLeft % 6 !== 0) return
    const spread = _player.radius * _player.scale * 0.8
    Particle.NewParticle(
      SparkParticle,
      _player.x + Phaser.Math.FloatBetween(-spread, spread),
      _player.y + Phaser.Math.FloatBetween(-spread, spread),
      Phaser.Math.FloatBetween(-20, 20),
      Phaser.Math.FloatBetween(-90, -50),
      { color: this.def.color, radius: Phaser.Math.FloatBetween(1.5, 2.5) }
    )
  }
}