import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Wrath1Def: BuffDef = {
  id: BuffID.Wrath1,
  name: 'Wrath 1',
  rarity: RarityID.Common,
  description: '+5% damage',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0xff4f6d,
  icon: IconID.Wrath,
  stats: [{ stat: BuffStatID.Damage, value: 0.05, isMultiplier: true }],
}

export class Wrath1 extends Buff {}