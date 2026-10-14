import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'
import { Enemy } from '../../../game/entities/enemies/Enemy'
import { Particle } from '../../../game/entities/particles/Particle'
import { SparkParticle } from '../../entities/particles/BasicParticles'
import type { Player } from '../../entities/Player'


export const Chilled2Def: BuffDef = {
  id: BuffID.Chilled2,
  name: 'Chilled 2',
  description: '-15% movement speed, -17.5% fire rate, and -3.5% damage taken',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Uncommon,
  color: 0x2383cc,
  tintStrength: 0.4,
  icon: IconID.Chilled,
  stats: [{ stat: BuffStatID.MoveSpeed, value: -0.15, isMultiplier: true }, { stat: BuffStatID.FireRate, value: -0.175, isMultiplier: true }, { stat: BuffStatID.DamageTaken, value: -0.035, isMultiplier: true }],
}

export class Chilled2 extends Buff {
  updateEnemy(enemy: Enemy): void {
    if (this.timeLeft % 13 !== 0) return
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
    if (this.timeLeft % 13 !== 0) return
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