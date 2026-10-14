import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'



export const Vulnerable3Def: BuffDef = {
  id: BuffID.Vulnerable3,
  name: 'Vulnerable 3',
  description: '+15% damage taken',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Epic,
  color: 0x8a8a8a,
  icon: IconID.Vulnerable,
  stats: [{ stat: BuffStatID.DamageTaken, value: 0.15, isMultiplier: true }],
}

export class Vulnerable3 extends Buff {}