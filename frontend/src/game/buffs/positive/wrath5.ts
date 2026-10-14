import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'


export const Wrath5Def: BuffDef = {
  id: BuffID.Wrath5,
  name: 'Wrath 5',
  rarity: RarityID.Epic,
  description: '+15% damage',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0xff4f6d,
  icon: IconID.Wrath,
  stats: [{ stat: BuffStatID.Damage, value: 0.15, isMultiplier: true }],
}

export class Wrath5 extends Buff {}