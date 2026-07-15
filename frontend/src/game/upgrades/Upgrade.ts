import type { GameManager } from '../core/GameManager'
import { UpgradeModifierSystem } from '../systems/upgrades/UpgradeModifierSystem'
import { UpgradeEffectSystem } from '../systems/upgrades/UpgradeEffectSystem'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../data/ID'
import type { Projectile } from '../entities/projectiles/Projectile'
import type { Enemy } from '../entities/enemies/Enemy'
import type { Player } from '../entities/Player'

/**
 * Declarative metadata for one upgrade — the "catalog" half of the
 * definition/instance split. Must stay JSON-serializable (no functions, no
 * class references) so it can later be code-generated into the backend's
 * upgrades.json verbatim.
 *
 * Browse/offer/UI code consumes defs only. Behavior lives on the Upgrade
 * class (the other half), which the engine instantiates per purchase.
 */
export interface DependencyGroup {
  ids: (string | { id: string; minStacks: number })[]
  count?: number // how many ids in this group must be satisfied (default: 1)
}

export interface UpgradeDef {
  id: string
  name: string
  description: string
  rarity: RarityID
  upgradeType: UpgradeTypeID
  cost: number

  // For stat_modifier type
  targetClass?: UpgradeTargetID
  fieldInTargetClass?: UpgradeStatID
  value?: number
  isMultiplier?: boolean // If true, value is a fractional bonus (0.2 = +20%)

  // For variant type
  variantClass?: string
  replaces?: string[] // Other variants this replaces

  // For effect/visual_effect/ability types
  effect?: string
  effectValue?: number

  // Offer filtering
  specificAttackType?: string

  // Stacking
  stackable: boolean
  maxStacks?: number

  // Upgrade tiers
  tier?: number
  upgradesTo?: string // ID of next tier upgrade

  // Dependencies — every group must be satisfied (AND across groups); within
  // a group, `count` of `ids` must be owned (OR/threshold, default 1). An id
  // may require a minimum stack count instead of plain ownership.
  dependentOn?: DependencyGroup[]
  incompatibleWith?: string[] // IDs of upgrades that cannot be owned if this upgrade is active

  // Curse
  curse?: boolean
}

/** Minimal structural view of Player needed by upgrade application. */
export interface PlayerLike {
  updatePolygon(): void
  setMaxDashCharges(charges: number): void
}

/** Engine surfaces handed to every hook that needs them. */
export interface UpgradeContext {
  gameManager: typeof GameManager
  player?: PlayerLike
  scene?: Phaser.Scene
}

/** Mutable damage wrapper so modify* hooks can change damage in place. */
export interface DamageRef {
  amount: number
}

/** Mutable explosion parameters, dispatched to modifyExplosion wherever an
 *  explosion is created (BulletExplosion spawn, Chain Reaction on-kill). */
export interface ExplosionSpec {
  damage: number
  radius: number
}

/**
 * Base class for all upgrade implementations — the behavior half of the
 * definition/instance split (modeled on tModLoader's ModBuff).
 *
 * The engine constructs one instance per purchase and calls the hooks below
 * at fixed dispatch points, in acquisition (ledger) order. Entities never
 * pull upgrade-specific values; they invoke one generic dispatch line per
 * extension point (see UpgradeSystem.dispatch*).
 *
 * The default onApply() applies the def generically (stat modifiers, effect
 * counters, abilities), so simple upgrades stay pure data with an empty class
 * body. Override hooks for anything the declarative fields can't express.
 */
export abstract class Upgrade {
  readonly def: UpgradeDef

  constructor(def: UpgradeDef) {
    this.def = def
  }

  get id(): string {
    return this.def.id
  }

  /**
   * One-time application on purchase — and again for every owned instance
   * whenever the ledger is replayed (save load, removal, reset). Must
   * therefore only accumulate onto base state the replay has just reset.
   *
   * Default behavior is driven entirely by the def:
   * - stat_modifier → player base stats (maxHealth/speed/polygonSides) are
   *   mutated directly; everything else goes through UpgradeModifierSystem
   * - effect → UpgradeEffectSystem counter (shield charges, ricochet, ...)
   * - visual_effect / ability → UpgradeEffectSystem flag
   * - variant → nothing (UpgradeSystem tracks the active variant itself)
   */
  onApply(ctx: UpgradeContext): void {
    const def = this.def
    switch (def.upgradeType) {
      case UpgradeTypeID.StatModifier: {
        if (!def.targetClass || !def.fieldInTargetClass || def.value === undefined) {
          console.error('Invalid stat_modifier upgrade:', def)
          return
        }
        if (def.targetClass === UpgradeTargetID.Player && this.isDirectPlayerStat(def.fieldInTargetClass)) {
          this.applyPlayerStat(ctx, def.fieldInTargetClass, def.value)
        } else {
          UpgradeModifierSystem.addModifier(
            def.targetClass,
            def.fieldInTargetClass,
            def.value,
            def.isMultiplier || false,
            def.curse || false
          )
        }
        break
      }

      case UpgradeTypeID.Effect:
        if (!def.effect) {
          console.error('Invalid effect upgrade:', def)
          return
        }
        UpgradeEffectSystem.addEffect(def.effect, def.effectValue ?? def.value ?? 0)
        break

      case UpgradeTypeID.VisualEffect:
        if (!def.effect) {
          console.error('Invalid visual_effect upgrade:', def)
          return
        }
        UpgradeEffectSystem.addVisualEffect(def.effect, def)
        break

      case UpgradeTypeID.Ability:
        if (!def.effect) {
          console.error('Invalid ability upgrade:', def)
          return
        }
        UpgradeEffectSystem.addAbility(def.effect)
        break

      case UpgradeTypeID.Variant:
        break
    }
  }

  /**
   * Symmetric undo, called when this instance is removed from the ledger
   * (dev-remove, variant replacement). The engine replays the remaining
   * ledger against base stats immediately afterwards, so most upgrades need
   * no override — implement this only for state the replay baseline doesn't
   * cover (external resources, scene objects, ...).
   */
  onRemove(_ctx: UpgradeContext): void {}

  /** Called for every player projectile right before it spawns. */
  modifyProjectileSpawn(_projectile: Projectile): void {}

  /** Mutate damage before a player projectile's hit is applied to an enemy. */
  modifyHitEnemy(_projectile: Projectile, _enemy: Enemy, _damage: DamageRef): void {}

  /** React after a player projectile's hit was applied to an enemy. */
  onHitEnemy(_projectile: Projectile, _enemy: Enemy, _damageDealt: number): void {}

  /** Mutate incoming player damage (armor, fragility). `source` is set for
   *  enemy melee contact, undefined for projectile hits. */
  modifyPlayerHurt(_damage: DamageRef, _source?: Enemy): void {}

  /** React to an enemy killed by the player. */
  onEnemyKilled(_enemy: Enemy): void {}

  /** Per-frame logic — the ModBuff.Update equivalent. */
  updatePlayer(_player: Player, _delta: number): void {}

  /** Mutate the parameters of any explosion the player creates. */
  modifyExplosion(_explosion: ExplosionSpec): void {}

  private isDirectPlayerStat(stat: UpgradeStatID): boolean {
    return stat === UpgradeStatID.MaxHealth || stat === UpgradeStatID.Speed || stat === UpgradeStatID.PolygonSides
  }

  private applyPlayerStat(ctx: UpgradeContext, stat: UpgradeStatID, value: number): void {
    const stats = ctx.gameManager.getPlayerStats()
    if (stat === UpgradeStatID.MaxHealth) {
      ctx.gameManager.updatePlayerStats({
        maxHealth: stats.maxHealth + value,
        health: stats.health + value
      })
    } else if (stat === UpgradeStatID.Speed) {
      ctx.gameManager.updatePlayerStats({ speed: stats.speed + value })
    } else if (stat === UpgradeStatID.PolygonSides) {
      ctx.gameManager.updatePlayerStats({ polygonSides: stats.polygonSides + value })
      ctx.player?.updatePolygon()
    }
  }
}
