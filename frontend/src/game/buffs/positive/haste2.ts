import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Haste2Def: BuffDef = {
  id: BuffID.Haste2,
  name: 'Haste 2',
  rarity: RarityID.Uncommon,
  description: '+7.5% move speed',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0x91fdff,
  icon: IconID.Haste,
  stats: [{ stat: BuffStatID.MoveSpeed, value: 0.075, isMultiplier: true }],
}

export class Haste2 extends Buff {}