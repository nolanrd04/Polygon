import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'


export const Slowness3Def: BuffDef = {
  id: BuffID.Slowness3,
  name: 'Slowness 3',
  description: '-25% move speed',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Rare,
  color: 0x9fe8ff,
  icon: IconID.Slowness,
  stats: [{ stat: BuffStatID.MoveSpeed, value: -0.25, isMultiplier: true }],
}

export class Slowness3 extends Buff {}