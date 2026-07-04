import { EventBus } from '../../core/EventBus'
import { GameManager } from '../../core/GameManager'
import { UpgradeEffectSystem } from './UpgradeEffectSystem'
import { UpgradeModifierSystem } from './UpgradeModifierSystem'
import { UpgradeTargetID, UpgradeTypeID } from '../../data/ID'
import {
  Upgrade,
  type UpgradeDef,
  type UpgradeContext,
  type DamageRef,
  type ExplosionSpec,
} from '../../upgrades/Upgrade'
import type { Projectile } from '../../entities/projectiles/Projectile'
import type { Enemy } from '../../entities/enemies/Enemy'
import type { Player } from '../../entities/Player'

/** The def/ctor pair the registry stores for each upgrade id. */
interface UpgradeEntry {
  def: UpgradeDef
  ctor: new (def: UpgradeDef) => Upgrade
}

/**
 * Central upgrade engine.
 *
 * Owns the per-run ledger: one Upgrade instance per purchase, in acquisition
 * order, kept aligned with GameManager's appliedUpgrades id array (the
 * serialized form). Stack counts, dependency checks, and replay order are all
 * derived from the ledger — there are no separate bookkeeping maps to drift.
 *
 * Also the hook dispatcher: entities call one generic dispatch* line per
 * extension point, and the engine invokes overridden hooks on every owned
 * instance in ledger order.
 */
class UpgradeSystemClass {
  /** One instance per purchase, in acquisition order. */
  private owned: Upgrade[] = []
  private activeVariants: Map<UpgradeTargetID, string> = new Map() // targetClass -> variantClass
  private ctx: UpgradeContext | null = null

  /** Provide the engine surfaces hooks receive. Called once per scene. */
  setContext(ctx: UpgradeContext): void {
    this.ctx = ctx
  }

  private requireContext(): UpgradeContext {
    if (!this.ctx) {
      // Fall back to a bare context so headless callers (tests, early boot)
      // still work; player-dependent hooks just no-op.
      this.ctx = { gameManager: GameManager }
    }
    return this.ctx
  }

  /**
   * Purchase/apply an upgrade: constructs a fresh instance from the entry,
   * appends it to the ledger, and runs its onApply. Returns false if the
   * upgrade cannot be applied right now.
   */
  apply(entry: UpgradeEntry): boolean {
    if (!this.canApply(entry.def)) {
      console.warn(`Cannot apply upgrade ${entry.def.id}`)
      return false
    }

    const ctx = this.requireContext()
    const instance = new entry.ctor(entry.def)

    // Variants evict whatever they replace from the ledger entirely
    let pruned = false
    if (entry.def.replaces) {
      for (const replacedId of entry.def.replaces) {
        pruned = this.pruneAll(replacedId) || pruned
      }
    }

    this.owned.push(instance)
    if (entry.def.upgradeType === UpgradeTypeID.Variant && entry.def.targetClass && entry.def.variantClass) {
      this.activeVariants.set(entry.def.targetClass, entry.def.variantClass)
    }

    if (pruned) {
      // The evicted variant's contributions must be unwound — replay covers
      // both that and the new instance's onApply.
      this.replay()
    } else {
      instance.onApply(ctx)
    }

    EventBus.emit('upgrade-applied', entry.def.id)
    return true
  }

  /**
   * Check if an upgrade could be applied right now (stacking, dependencies,
   * incompatibilities, attack-type match). Operates purely on defs.
   */
  canApply(def: UpgradeDef): boolean {
    if (!this.canMeetDependencies(def)) return false

    if (def.incompatibleWith) {
      for (const incompatibleId of def.incompatibleWith) {
        if (this.hasUpgrade(incompatibleId)) return false
      }
    }

    const stacks = this.getStackCount(def.id)
    if (def.stackable && def.maxStacks && stacks >= def.maxStacks) return false
    if (!def.stackable && stacks > 0) return false

    if (def.specificAttackType) {
      const state = GameManager.getState()
      const currentAttackType = state.playerStats.unlockedAttacks[0] || 'bullet'
      if (def.specificAttackType !== currentAttackType) return false
    }

    return true
  }

  private canMeetDependencies(def: UpgradeDef): boolean {
    if (!def.dependentOn || def.dependentOn.length === 0) return true

    const required = def.dependencyCount || 1
    let met = 0
    for (const dependentId of def.dependentOn) {
      if (this.hasUpgrade(dependentId)) met++
    }
    return met >= required
  }

  /**
   * Remove the most recently purchased instance of an upgrade (dev tools),
   * then replay the remaining ledger against base stats.
   */
  removeOne(upgradeId: string): void {
    const ctx = this.requireContext()
    for (let i = this.owned.length - 1; i >= 0; i--) {
      if (this.owned[i].id === upgradeId) {
        const [instance] = this.owned.splice(i, 1)
        instance.onRemove(ctx)
        ctx.gameManager.removeLastAppliedUpgrade(upgradeId)
        this.replay()
        return
      }
    }
  }

  /** Remove every instance of an id from the ledger (variant replacement).
   *  Caller is responsible for replaying afterwards. */
  private pruneAll(upgradeId: string): boolean {
    const ctx = this.requireContext()
    let removed = false
    for (let i = this.owned.length - 1; i >= 0; i--) {
      if (this.owned[i].id === upgradeId) {
        const [instance] = this.owned.splice(i, 1)
        instance.onRemove(ctx)
        ctx.gameManager.removeLastAppliedUpgrade(upgradeId)
        removed = true
      }
    }
    return removed
  }

  /**
   * Rebuild instances from a saved ledger (save load) and replay them.
   * Same code path as removal — edit ledger, replay.
   */
  restore(entries: UpgradeEntry[]): void {
    this.owned = entries.map(entry => new entry.ctor(entry.def))
    this.replay()
  }

  /**
   * Replay the ledger: reset every derived surface to its base state, then
   * re-run onApply for each owned instance in acquisition order. Current
   * health is preserved (clamped to the recomputed max) — hooks may heal
   * during replay but the snapshot wins, so restoring a save never
   * double-applies health and removing an upgrade never heals.
   */
  replay(): void {
    const ctx = this.requireContext()
    const healthBefore = ctx.gameManager.getPlayerStats().health

    UpgradeModifierSystem.reset()
    UpgradeEffectSystem.reset()
    this.activeVariants.clear()
    ctx.gameManager.resetStatsToBase()
    ctx.player?.setMaxDashCharges(1)

    for (const instance of this.owned) {
      const def = instance.def
      if (def.upgradeType === UpgradeTypeID.Variant && def.targetClass && def.variantClass) {
        this.activeVariants.set(def.targetClass, def.variantClass)
      }
      instance.onApply(ctx)
    }

    const stats = ctx.gameManager.getPlayerStats()
    ctx.gameManager.updatePlayerStats({ health: Math.min(healthBefore, stats.maxHealth) })
    ctx.player?.updatePolygon()
  }

  /**
   * Reset all upgrades (new game / dev tools). Clears the ledger and replays
   * the empty ledger so every derived surface returns to base.
   */
  reset(): void {
    this.owned = []
    this.activeVariants.clear()
    if (this.ctx) {
      this.ctx.gameManager.setAppliedUpgrades([])
      this.replay()
    } else {
      UpgradeModifierSystem.reset()
      UpgradeEffectSystem.reset()
    }
  }

  // ============================================================
  // QUERIES — all derived from the ledger
  // ============================================================

  hasUpgrade(upgradeId: string): boolean {
    return this.owned.some(instance => instance.id === upgradeId)
  }

  getStackCount(upgradeId: string): number {
    return this.owned.reduce((count, instance) => count + (instance.id === upgradeId ? 1 : 0), 0)
  }

  /** All owned instances in acquisition order. */
  getOwned(): readonly Upgrade[] {
    return this.owned
  }

  /**
   * Get the active variant class for a target.
   * Returns null if no variant is active (use default class).
   */
  getVariant(target: UpgradeTargetID): string | null {
    return this.activeVariants.get(target) || null
  }

  // ============================================================
  // HOOK DISPATCH — called by the engine at fixed extension points.
  // Iterates owned instances in ledger order, skipping instances that
  // don't override the hook.
  // ============================================================

  dispatchModifyProjectileSpawn(projectile: Projectile): void {
    for (const u of this.owned) {
      if (u.modifyProjectileSpawn !== baseProto.modifyProjectileSpawn) u.modifyProjectileSpawn(projectile)
    }
  }

  dispatchModifyHitEnemy(projectile: Projectile, enemy: Enemy, damage: DamageRef): void {
    for (const u of this.owned) {
      if (u.modifyHitEnemy !== baseProto.modifyHitEnemy) u.modifyHitEnemy(projectile, enemy, damage)
    }
  }

  dispatchOnHitEnemy(projectile: Projectile, enemy: Enemy, damageDealt: number): void {
    for (const u of this.owned) {
      if (u.onHitEnemy !== baseProto.onHitEnemy) u.onHitEnemy(projectile, enemy, damageDealt)
    }
  }

  dispatchModifyPlayerHurt(damage: DamageRef, source?: Enemy): void {
    for (const u of this.owned) {
      if (u.modifyPlayerHurt !== baseProto.modifyPlayerHurt) u.modifyPlayerHurt(damage, source)
    }
  }

  dispatchOnEnemyKilled(enemy: Enemy): void {
    for (const u of this.owned) {
      if (u.onEnemyKilled !== baseProto.onEnemyKilled) u.onEnemyKilled(enemy)
    }
  }

  dispatchUpdatePlayer(player: Player, delta: number): void {
    for (const u of this.owned) {
      if (u.updatePlayer !== baseProto.updatePlayer) u.updatePlayer(player, delta)
    }
  }

  dispatchModifyExplosion(explosion: ExplosionSpec): void {
    for (const u of this.owned) {
      if (u.modifyExplosion !== baseProto.modifyExplosion) u.modifyExplosion(explosion)
    }
  }
}

/** Base hook implementations — dispatch skips instances that don't override. */
const baseProto = Upgrade.prototype

export const UpgradeSystem = new UpgradeSystemClass()
