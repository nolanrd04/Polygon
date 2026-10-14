import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'
import { GameManager } from '../../core/GameManager'
import type { Player } from '../../entities/Player'
import type { Enemy } from '../../entities/enemies/Enemy'

/** Fraction of max HP healed per second. */
const REGEN_FRACTION = 0.01

export const MendingDef: BuffDef = {
  id: BuffID.Mending,
  name: 'Mending',
  rarity: RarityID.Uncommon,
  description: 'Regenerate 1% max HP/sec. Stackable in time.',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: true,
  color: 0x34eb49,
  icon: IconID.Mending, 
}

// No `stats`: LifeRegen has no base for a multiplier to scale, so the flat
// amount is worked out from the host's max HP each tick instead.
export class Mending extends Buff {
  updatePlayer(player: Player): void {
    player.buffStats.add(BuffStatID.LifeRegen, GameManager.getPlayerStats().maxHealth * REGEN_FRACTION, false)
  }

  updateEnemy(enemy: Enemy): void {
    enemy.buffStats.add(BuffStatID.LifeRegen, enemy.maxHealth * REGEN_FRACTION, false)
  }
}
