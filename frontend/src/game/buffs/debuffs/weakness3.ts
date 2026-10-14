import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Weakness3Def: BuffDef = {
  id: BuffID.Weakness3,
  name: 'Weakness 3',
  description: '-20% output damage (contact and projectiles)',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Epic,
  color: 0x8a8a8a,
  icon: IconID.Weakness,
  stats: [{ stat: BuffStatID.Damage, value: -0.2, isMultiplier: true }],
}

export class Weakness3 extends Buff {}