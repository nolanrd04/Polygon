import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Wrath4Def: BuffDef = {
  id: BuffID.Wrath4,
  name: 'Wrath 4',
  rarity: RarityID.Epic,
  description: '+12.5% damage',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0xff4f6d,
  icon: IconID.Wrath,
  stats: [{ stat: BuffStatID.Damage, value: 0.125, isMultiplier: true }],
}

export class Wrath4 extends Buff {}