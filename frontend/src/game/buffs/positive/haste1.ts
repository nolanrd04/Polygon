import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Haste1Def: BuffDef = {
  id: BuffID.Haste1,
  name: 'Haste 1',
  rarity: RarityID.Common,
  description: '+5% move speed',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0x91fdff,
  icon: IconID.Haste,
  stats: [{ stat: BuffStatID.MoveSpeed, value: 0.05, isMultiplier: true }],
}

export class Haste1 extends Buff {}