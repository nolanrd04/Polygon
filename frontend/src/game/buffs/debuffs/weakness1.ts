import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Weakness1Def: BuffDef = {
  id: BuffID.Weakness1,
  name: 'Weakness 1',
  description: '-10% output damage (contact and projectiles)',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Uncommon,
  color: 0x8a8a8a,
  icon: IconID.Weakness,
  stats: [{ stat: BuffStatID.Damage, value: -0.1, isMultiplier: true }],
}

export class Weakness1 extends Buff {}