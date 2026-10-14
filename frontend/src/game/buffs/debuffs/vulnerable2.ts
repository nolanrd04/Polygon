import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'


export const Vulnerable2Def: BuffDef = {
  id: BuffID.Vulnerable2,
  name: 'Vulnerable 2',
  description: '+10% damage taken',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Epic,
  color: 0x8a8a8a,
  icon: IconID.Vulnerable,
  stats: [{ stat: BuffStatID.DamageTaken, value: 0.1, isMultiplier: true }],
}

export class Vulnerable2 extends Buff {}