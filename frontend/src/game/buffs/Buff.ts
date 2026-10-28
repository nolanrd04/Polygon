import { FIXED_STEP_MS } from '../core/GameConfig'
import type { BuffHostID, BuffID, BuffStatID, IconID } from '../data/ID'
import type { Player } from '../entities/Player'
import type { Enemy } from '../entities/enemies/Enemy'
import type { Projectile } from '../entities/projectiles/Projectile'
import type { DamageRef } from '../upgrades/Upgrade'
import type { BuffContainer } from './BuffContainer'
import type { BuffStats } from './BuffStats'

export interface BuffStatEffect {
  stat: BuffStatID
  value: number
  isMultiplier: boolean // true = fractional bonus (0.2 = +20%)
}

/**
 * A DoT debuff a projectile hit applies (Burning Bullets, Poison Tipped
 * Rounds). Each tick deals max(the debuff's own LifeRegen, fraction × the
 * projectile's damage) per second, and a hit refreshes rather than adds.
 * On the def so the backend's DoT ceiling reads the same numbers.
 */
export interface DotOnHit {
  buff: BuffID
  fraction: number
  /** ms */
  duration: number
}

/**
 * Declarative metadata for one buff. Must stay JSON-serializable (no
 * functions, no class references), like UpgradeDef, so the backend can read
 * the numbers for wave validation.
 */
export interface BuffDef {
  id: BuffID
  name: string
  rarity: string
  description: string
  appliesTo: BuffHostID[]
  isDebuff: boolean
  /**
   * Duration only — a buff's values never stack.
   * true: reapplying adds the new duration to what's left.
   * false: reapplying keeps the longer of the remaining and the new duration.
   */
  stacking: boolean
  /** Cap on remaining duration in ms. Mostly matters for stacking buffs. */
  maxDuration?: number
  /** Hide from the HUD buff row. */
  hidden?: boolean
  /** HUD icon. Omit for the generic buff/debuff icon. */
  icon?: IconID
  /** Tints the icon, and the host's sprite if tintStrength is set. */
  color: number
  /** 0-1: how far the host's sprite is blended toward `color` while active. Omit for no tint. */
  tintStrength?: number
  /** Applied every tick by the default applyStats(), so pure stat buffs need no class body. */
  stats?: BuffStatEffect[]
  /** Read by the buff's own onProjectileHit; see DotOnHit. */
  dotOnHit?: DotOnHit
}

/** Per-stat values for one application. Only stats the def declares are used. */
export type BuffStatOverrides = Partial<Record<BuffStatID, number>>

/** Options for one AddBuff call. Both default to the def's values. */
export interface AddBuffOptions {
  /** Overrides the def's `stacking` rule for this one application. */
  stacking?: boolean
  /** Replaces the def's value for these stats, e.g. a burn scaled from the hit's damage. */
  stats?: BuffStatOverrides
}

/** One active player buff as the HUD sees it (polled via `request-buff-state`). */
export interface BuffSlotState {
  id: BuffID
  msLeft: number
  /** The values this application uses, overrides included. */
  stats: BuffStatEffect[]
  /** Held until the next wave starts (a between-wave bundle pickup). msLeft is its full duration. */
  pending?: boolean
}

/** Anything that can carry buffs. Implemented by Player and Enemy. */
export interface BuffHost {
  readonly buffHostKind: BuffHostID
  readonly buffs: BuffContainer
  readonly buffStats: BuffStats
  readonly buffImmune?: readonly BuffID[]
  AddBuff(id: BuffID, ms: number, options?: AddBuffOptions): boolean
  HasBuff(id: BuffID): boolean
  ClearBuff(id: BuffID): boolean
}

export function msToTicks(ms: number): number {
  return Math.max(0, Math.round(ms / FIXED_STEP_MS))
}

export function ticksToMs(ticks: number): number {
  return ticks * FIXED_STEP_MS
}

/**
 * Base class for all buffs and debuffs — modeled on tModLoader's ModBuff.
 *
 * One instance per active buff per host, created by BuffContainer when the
 * buff lands and dropped when it ends, so per-instance state is safe. The
 * container owns the timer; hooks below are called by the engine, never the
 * reverse. See frontend/documentation/BUFFS.md.
 */
export abstract class Buff {
  readonly def: BuffDef
  /** Remaining duration in logic ticks. Owned by BuffContainer. */
  timeLeft: number = 0
  /** Stat values this application uses instead of the def's. Owned by BuffContainer. */
  statOverrides: BuffStatOverrides = {}

  constructor(def: BuffDef) {
    this.def = def
  }

  get id(): BuffID {
    return this.def.id
  }

  /** The value this instance applies for `stat`: its override, else the def's (0 if undeclared). */
  statValue(stat: BuffStatID): number {
    return this.statOverrides[stat] ?? this.def.stats?.find(e => e.stat === stat)?.value ?? 0
  }

  /**
   * Reapplication: per declared stat, keep whichever value is larger in
   * magnitude, so a weaker hit never downgrades a stronger one.
   */
  mergeStats(incoming: BuffStatOverrides = {}): void {
    for (const effect of this.def.stats ?? []) {
      const value = incoming[effect.stat] ?? effect.value
      if (Math.abs(value) > Math.abs(this.statValue(effect.stat))) {
        this.statOverrides[effect.stat] = value
      }
    }
  }

  /** The buff just landed on a host that didn't have it. */
  onApply(_host: BuffHost): void {}

  /**
   * The host already has this buff. Return true if you handled the timer
   * yourself; false (default) applies the def's `stacking` rule.
   */
  onReapply(_host: BuffHost, _ticks: number): boolean {
    return false
  }

  /** The buff left the host: expiry, ClearBuff, wave end, or host death. */
  onRemove(_host: BuffHost): void {}

  /** Writes the def's declarative stats (or this application's overrides) into the host's layer, every tick. */
  applyStats(stats: BuffStats): void {
    if (!this.def.stats) return
    for (const effect of this.def.stats) {
      stats.add(effect.stat, this.statOverrides[effect.stat] ?? effect.value, effect.isMultiplier)
    }
  }

  /** Per-tick logic on a player — ModBuff.Update(Player). */
  updatePlayer(_player: Player): void {}

  /** Per-tick logic on an enemy — ModBuff.Update(NPC). */
  updateEnemy(_enemy: Enemy): void {}

  /**
   * After the player is drawn each tick. For visuals tint and particles can't
   * do (rings, auras): create game objects in onApply, place them here,
   * destroy them in onRemove.
   */
  drawPlayer(_player: Player): void {}

  /** After an enemy's PostDraw each tick. Worm segments each get their own call. */
  drawEnemy(_enemy: Enemy): void {}

  /** On a player: mutate incoming damage, after upgrade armor. `source` is set for melee contact. */
  modifyPlayerHurt(_player: Player, _damage: DamageRef, _source?: Enemy): void {}

  /** On an enemy: mutate incoming damage before armor. */
  modifyEnemyHurt(_enemy: Enemy, _damage: DamageRef): void {}

  /** On a player: mutate one of their projectile hits before it lands. */
  modifyHitEnemy(_projectile: Projectile, _enemy: Enemy, _damage: DamageRef): void {}

  /** On a player: react after one of their projectile hits landed (e.g. apply a debuff). */
  onHitEnemy(_projectile: Projectile, _enemy: Enemy, _damageDealt: number): void {}

  /**
   * On any host: a projectile it fires is about to spawn. Stamp
   * `projectile.buffFlags` here to make onProjectileHit run when it lands.
   */
  modifyProjectileSpawn(_projectile: Projectile): void {}

  /**
   * A projectile stamped with this buff's id hit something (an enemy for
   * player shots, the player for enemy shots). Fires even if the shooter has
   * since lost the buff, so it runs on a shared instance: don't read `this`
   * state or timeLeft here.
   */
  onProjectileHit(_projectile: Projectile, _target: BuffHost): void {}
}
