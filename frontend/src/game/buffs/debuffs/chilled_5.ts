import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'
import { Enemy } from '../../entities/enemies/Enemy'
import { Particle } from '../../entities/particles/Particle'
import { SparkParticle } from '../../entities/particles/BasicParticles'
import type { Player } from '../../entities/Player'



export const Chilled5Def: BuffDef = {
  id: BuffID.Chilled5,
  name: 'Chilled 5',
  description: '-35% movement speed, -30% fire rate, and -6% damage taken',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Legendary,
  color: 0x2383cc,
  tintStrength: 0.4,
  icon: IconID.Chilled,
  stats: [{ stat: BuffStatID.MoveSpeed, value: -0.35, isMultiplier: true }, { stat: BuffStatID.FireRate, value: -0.3, isMultiplier: true }, { stat: BuffStatID.DamageTaken, value: -0.06, isMultiplier: true }],
}

export class Chilled5 extends Buff {
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