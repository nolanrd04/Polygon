import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'


export const Slowness2Def: BuffDef = {
  id: BuffID.Slowness2,
  name: 'Slowness 2',
  description: '-20% move speed',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Uncommon,
  color: 0x9fe8ff,
  icon: IconID.Slowness,
  stats: [{ stat: BuffStatID.MoveSpeed, value: -0.2, isMultiplier: true }],
}

export class Slowness2 extends Buff {}