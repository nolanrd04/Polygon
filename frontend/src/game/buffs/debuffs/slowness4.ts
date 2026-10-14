import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'



export const Slowness4Def: BuffDef = {
  id: BuffID.Slowness4,
  name: 'Slowness 4',
  description: '-30% move speed',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Epic,
  color: 0x9fe8ff,
  icon: IconID.Slowness,
  stats: [{ stat: BuffStatID.MoveSpeed, value: -0.30, isMultiplier: true }],
}

export class Slowness4 extends Buff {}