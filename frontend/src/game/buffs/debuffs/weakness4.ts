import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Weakness4Def: BuffDef = {
  id: BuffID.Weakness4,
  name: 'Weakness 4',
  description: '-25% output damage (contact and projectiles)',
  appliesTo: [BuffHostID.Enemy, BuffHostID.Player],
  isDebuff: true,
  stacking: false,
  rarity: RarityID.Legendary,
  color: 0x8a8a8a,
  icon: IconID.Weakness,
  stats: [{ stat: BuffStatID.Damage, value: -0.25, isMultiplier: true }],
}

export class Weakness4 extends Buff {}