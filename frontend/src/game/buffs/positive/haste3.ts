import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Haste3Def: BuffDef = {
  id: BuffID.Haste3,
  name: 'Haste 3',
  rarity: RarityID.Rare,
  description: '+10% move speed',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0x91fdff,
  icon: IconID.Haste,
  stats: [{ stat: BuffStatID.MoveSpeed, value: 0.1, isMultiplier: true }],
}

export class Haste3 extends Buff {}