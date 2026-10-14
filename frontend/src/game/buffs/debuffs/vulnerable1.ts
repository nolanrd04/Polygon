import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'


export const Vulnerable1Def: BuffDef = {
  id: BuffID.Vulnerable1,
  name: 'Vulnerable 1',
  description: '+5% damage taken',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Rare,
  color: 0x8a8a8a,
  icon: IconID.Vulnerable,
  stats: [{ stat: BuffStatID.DamageTaken, value: 0.05, isMultiplier: true }],
}

export class Vulnerable1 extends Buff {}