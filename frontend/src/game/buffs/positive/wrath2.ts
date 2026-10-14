import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Wrath2Def: BuffDef = {
  id: BuffID.Wrath2,
  name: 'Wrath 2',
  rarity: RarityID.Uncommon,
  description: '+7.5% damage',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0xff4f6d,
  icon: IconID.Wrath,
  stats: [{ stat: BuffStatID.Damage, value: 0.075, isMultiplier: true }],
}

export class Wrath2 extends Buff {}