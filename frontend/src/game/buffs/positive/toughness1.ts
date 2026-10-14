import { Buff, type BuffDef } from '../Buff'
import { BuffID, BuffHostID, BuffStatID, RarityID, IconID } from '../../data/ID'

export const Toughness1Def: BuffDef = {
  id: BuffID.Toughness1,
  name: 'Toughness 1',
  rarity: RarityID.Rare,
  description: '-10% damage taken',
  appliesTo: [BuffHostID.Player, BuffHostID.Enemy],
  isDebuff: false,
  stacking: false,
  color: 0xfcd538,
  icon: IconID.Toughness,
  stats: [{ stat: BuffStatID.DamageTaken, value: -0.10, isMultiplier: true }],
}

export class Toughness1 extends Buff {}