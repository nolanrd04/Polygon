/**
 * Upgrade Registry — pairs each upgrade's declarative def (plain data, safe
 * for browse/offer/UI code) with its behavior class (instantiated once per
 * purchase by UpgradeSystem).
 *
 * Registration is automatic: every module under the category folders must
 * export exactly one UpgradeDef object and one Upgrade subclass. Drop a new
 * file in and it's registered — no manual list to maintain.
 */

import { Upgrade, type UpgradeDef } from './Upgrade'

export interface UpgradeEntry {
  def: UpgradeDef
  ctor: new (def: UpgradeDef) => Upgrade
}

const modules = import.meta.glob(
  './{stat_modifiers,effects,variants,visual_effects,abilities,curses}/*.ts',
  { eager: true }
) as Record<string, Record<string, unknown>>

export const UPGRADE_REGISTRY: Record<string, UpgradeEntry> = {}

for (const [path, mod] of Object.entries(modules)) {
  let def: UpgradeDef | undefined
  let ctor: UpgradeEntry['ctor'] | undefined

  for (const exported of Object.values(mod)) {
    if (typeof exported === 'function' && exported.prototype instanceof Upgrade) {
      ctor = exported as UpgradeEntry['ctor']
    } else if (exported && typeof exported === 'object' && 'id' in exported) {
      def = exported as UpgradeDef
    }
  }

  if (!def || !ctor) {
    console.error(`Upgrade module ${path} must export one UpgradeDef object and one Upgrade subclass`)
    continue
  }
  if (UPGRADE_REGISTRY[def.id]) {
    console.error(`Duplicate upgrade id '${def.id}' in ${path}`)
    continue
  }
  UPGRADE_REGISTRY[def.id] = { def, ctor }
}

export function getUpgradeEntry(upgradeId: string): UpgradeEntry | undefined {
  return UPGRADE_REGISTRY[upgradeId]
}

export function getUpgrade(upgradeId: string): UpgradeDef | undefined {
  return UPGRADE_REGISTRY[upgradeId]?.def
}

export function getAllUpgrades(): UpgradeDef[] {
  return Object.values(UPGRADE_REGISTRY).map(entry => entry.def)
}
