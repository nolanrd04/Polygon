import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Toughness2Def: BuffDef = {
  id: BuffID.Toughness2,
  name: 'Toughness 2',
  rarity: RarityID.Epic,
  description: '-15% damage taken',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0xfcd538,
  icon: IconID.Toughness,
  stats: [{ stat: BuffStatID.DamageTaken, value: -0.15, isMultiplier: true }],
}

export class Toughness2 extends Buff {}