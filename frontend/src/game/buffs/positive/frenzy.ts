import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const FrenzyDef: BuffDef = {
  id: BuffID.Frenzy,
  name: 'Frenzy',
  rarity: RarityID.Uncommon,
  description: '+10% fire rate',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0xff5c5c,
  icon: IconID.Frenzy,
  stats: [{ stat: BuffStatID.FireRate, value: 0.1, isMultiplier: true }],
}

export class Frenzy extends Buff {}