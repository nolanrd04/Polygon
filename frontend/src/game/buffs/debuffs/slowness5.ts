import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'



export const Slowness5Def: BuffDef = {
  id: BuffID.Slowness5,
  name: 'Slowness 5',
  description: '-35% move speed',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Legendary,
  color: 0x9fe8ff,
  icon: IconID.Slowness,
  stats: [{ stat: BuffStatID.MoveSpeed, value: -0.35, isMultiplier: true }],
}

export class Slowness5 extends Buff {}