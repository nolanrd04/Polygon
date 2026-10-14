import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Wrath3Def: BuffDef = {
  id: BuffID.Wrath3,
  name: 'Wrath 3',
  rarity: RarityID.Rare,
  description: '+10% damage',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0xff4f6d,
  icon: IconID.Wrath,
  stats: [{ stat: BuffStatID.Damage, value: 0.1, isMultiplier: true }],
}

export class Wrath3 extends Buff {}