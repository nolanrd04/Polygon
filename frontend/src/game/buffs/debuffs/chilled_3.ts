import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'
import { Enemy } from '../../entities/enemies/Enemy'
import { Particle } from '../../entities/particles/Particle'
import { SparkParticle } from '../../entities/particles/BasicParticles'
import type { Player } from '../../entities/Player'


export const Chilled3Def: BuffDef = {
  id: BuffID.Chilled3,
  name: 'Chilled 3',
  description: '-22% movement speed, -20% fire rate, and -4.5% damage taken',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Rare,
  color: 0x2383cc,
  tintStrength: 0.4,
  icon: IconID.Chilled,
  stats: [{ stat: BuffStatID.MoveSpeed, value: -0.22, isMultiplier: true }, { stat: BuffStatID.FireRate, value: -0.2, isMultiplier: true }, { stat: BuffStatID.DamageTaken, value: -0.045, isMultiplier: true }],
}

export class Chilled3 extends Buff {
  updateEnemy(enemy: Enemy): void {
    if (this.timeLeft % 12 !== 0) return
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
    if (this.timeLeft % 12 !== 0) return
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