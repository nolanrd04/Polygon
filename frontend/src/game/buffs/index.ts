/**
 * Buff Registry — pairs each buff's declarative def with its behavior class
 * (instantiated per application by BuffContainer).
 *
 * Registration is automatic: every module under the category folders must
 * export exactly one BuffDef object and one Buff subclass, same as upgrades.
 */

import type { Projectile } from '../entities/projectiles/Projectile'
import { Buff, type BuffDef, type BuffHost } from './Buff'

export interface BuffEntry {
  def: BuffDef
  ctor: new (def: BuffDef) => Buff
  /** Stateless instance for hooks that run without a host, e.g. onProjectileHit. */
  shared: Buff
}

const modules = import.meta.glob(
  './{positive,debuffs}/*.ts',
  { eager: true }
) as Record<string, Record<string, unknown>>

export const BUFF_REGISTRY: Record<string, BuffEntry> = {}

for (const [path, mod] of Object.entries(modules)) {
  let def: BuffDef | undefined
  let ctor: BuffEntry['ctor'] | undefined

  for (const exported of Object.values(mod)) {
    if (typeof exported === 'function' && exported.prototype instanceof Buff) {
      ctor = exported as BuffEntry['ctor']
    } else if (exported && typeof exported === 'object' && 'id' in exported && 'appliesTo' in exported) {
      def = exported as BuffDef
    }
  }

  if (!def || !ctor) {
    console.error(`Buff module ${path} must export one BuffDef object and one Buff subclass`)
    continue
  }
  if (BUFF_REGISTRY[def.id]) {
    console.error(`Duplicate buff id '${def.id}' in ${path}`)
    continue
  }
  BUFF_REGISTRY[def.id] = { def, ctor, shared: new ctor(def) }
}

export function getBuffEntry(buffId: string): BuffEntry | undefined {
  return BUFF_REGISTRY[buffId]
}

export function getAllBuffs(): BuffDef[] {
  return Object.values(BUFF_REGISTRY).map(entry => entry.def)
}

/** Runs onProjectileHit for every buff id stamped on the projectile at fire time. */
export function dispatchProjectileHit(projectile: Projectile, target: BuffHost): void {
  for (const id of projectile.buffFlags) {
    getBuffEntry(id)?.shared.onProjectileHit(projectile, target)
  }
}
