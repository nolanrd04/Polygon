import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'


export const Slowness1Def: BuffDef = {
  id: BuffID.Slowness1,
  name: 'Slowness 1',
  description: '-15% move speed',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Common,
  color: 0x9fe8ff,
  icon: IconID.Slowness,
  stats: [{ stat: BuffStatID.MoveSpeed, value: -0.15, isMultiplier: true }],
}

export class Slowness1 extends Buff {}