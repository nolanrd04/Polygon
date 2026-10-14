import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Weakness2Def: BuffDef = {
  id: BuffID.Weakness2,
  name: 'Weakness 2',
  description: '-15% output damage (contact and projectiles)',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Rare,
  color: 0x8a8a8a,
  icon: IconID.Weakness,
  stats: [{ stat: BuffStatID.Damage, value: -0.15, isMultiplier: true }],
}

export class Weakness2 extends Buff {}