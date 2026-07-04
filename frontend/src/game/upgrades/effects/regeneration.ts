import { Upgrade, type UpgradeDef } from '../Upgrade'
import { GameManager } from '../../core/GameManager'
import type { Player } from '../../entities/Player'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const RegenerationDef: UpgradeDef = {
  id: "regeneration",
  name: "Auto Repair",
  description: "Regenerate 1 HP/sec",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Effect,
  cost: 20,
  effect: "regen",
  effectValue: 1,
  stackable: true,
  maxStacks: 3,
}

export class Regeneration extends Upgrade {
  onApply(): void {}

  updatePlayer(_player: Player, delta: number): void {
    GameManager.heal(this.def.effectValue! * (delta / 1000))
  }
}
