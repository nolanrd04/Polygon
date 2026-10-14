import { BuffHostID, type BuffID } from '../data/ID'
import type { Player } from '../entities/Player'
import type { Enemy } from '../entities/enemies/Enemy'
import type { Projectile } from '../entities/projectiles/Projectile'
import type { DamageRef } from '../upgrades/Upgrade'
import { blendColor } from '../entities/enemies/ArrowHead/ArrowHeadConfig'
import { msToTicks, ticksToMs, type AddBuffOptions, type Buff, type BuffHost, type BuffSlotState } from './Buff'
import { getBuffEntry } from './index'

/**
 * The active buffs on one host — tModLoader's buffType[]/buffTime[] pair.
 * Player and Enemy each own one and expose it through AddBuff/HasBuff/...
 *
 * update() runs once per fixed logic tick (MainScene.stepLogic), so durations
 * are counted in ticks: pausing stops them and lag slows them with the game.
 */
export class BuffContainer {
  private readonly host: BuffHost
  private active: Buff[] = []

  constructor(host: BuffHost) {
    this.host = host
  }

  /**
   * Returns false if the buff is unknown, can't sit on this host, or the host
   * is immune. `options` override the def's stacking rule and stat values for
   * this one application.
   */
  add(id: BuffID, ms: number, options: AddBuffOptions = {}): boolean {
    const entry = getBuffEntry(id)
    if (!entry) {
      console.error(`Unknown buff '${id}'`)
      return false
    }
    const def = entry.def
    if (!def.appliesTo.includes(this.host.buffHostKind)) return false
    if (this.host.buffImmune?.includes(id)) return false

    const ticks = msToTicks(ms)
    if (ticks <= 0) return false
    const cap = def.maxDuration !== undefined ? msToTicks(def.maxDuration) : Infinity

    const existing = this.find(id)
    if (existing) {
      if (!existing.onReapply(this.host, ticks)) {
        const stacks = options.stacking ?? def.stacking
        existing.timeLeft = stacks ? existing.timeLeft + ticks : Math.max(existing.timeLeft, ticks)
      }
      existing.timeLeft = Math.min(existing.timeLeft, cap)
      existing.mergeStats(options.stats)
      return true
    }

    const buff = new entry.ctor(def)
    buff.timeLeft = Math.min(ticks, cap)
    buff.statOverrides = { ...options.stats }
    this.active.push(buff)
    buff.onApply(this.host)
    return true
  }

  has(id: BuffID): boolean {
    return this.find(id) !== undefined
  }

  /** Remaining time in ms, or 0 if the buff isn't active. */
  getTimeLeft(id: BuffID): number {
    const buff = this.find(id)
    return buff ? ticksToMs(buff.timeLeft) : 0
  }

  remove(id: BuffID): boolean {
    const index = this.active.findIndex(b => b.id === id)
    if (index === -1) return false
    const [buff] = this.active.splice(index, 1)
    buff.onRemove(this.host)
    return true
  }

  clear(): void {
    const removed = this.active
    this.active = []
    for (const buff of removed) buff.onRemove(this.host)
  }

  getAll(): readonly Buff[] {
    return this.active
  }

  /** `base` blended toward each active buff's color by its tintStrength. Display only. */
  tint(base: number): number {
    let color = base
    for (const buff of this.active) {
      if (buff.def.tintStrength) color = blendColor(color, buff.def.color, buff.def.tintStrength)
    }
    return color
  }

  /**
   * One tick: reset the stat layer, let every buff write into it and run its
   * update hook, then drop the ones that ran out. Iterates a snapshot so a
   * buff may add or clear buffs (including itself) from its own hook.
   */
  update(): void {
    this.host.buffStats.reset()
    if (this.active.length === 0) return

    for (const buff of this.active.slice()) {
      if (!this.active.includes(buff)) continue
      buff.applyStats(this.host.buffStats)
      if (this.host.buffHostKind === BuffHostID.Player) {
        buff.updatePlayer(this.host as unknown as Player)
      } else {
        buff.updateEnemy(this.host as unknown as Enemy)
      }
      buff.timeLeft--
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const buff = this.active[i]
      if (buff.timeLeft <= 0) {
        this.active.splice(i, 1)
        buff.onRemove(this.host)
      }
    }
  }

  // ============================================================
  // HOOK DISPATCH — one call next to each matching UpgradeSystem.dispatch*
  // ============================================================

  dispatchModifyPlayerHurt(player: Player, damage: DamageRef, source?: Enemy): void {
    for (const buff of this.active) buff.modifyPlayerHurt(player, damage, source)
  }

  dispatchModifyEnemyHurt(enemy: Enemy, damage: DamageRef): void {
    for (const buff of this.active) buff.modifyEnemyHurt(enemy, damage)
  }

  dispatchModifyHitEnemy(projectile: Projectile, enemy: Enemy, damage: DamageRef): void {
    for (const buff of this.active) buff.modifyHitEnemy(projectile, enemy, damage)
  }

  dispatchOnHitEnemy(projectile: Projectile, enemy: Enemy, damageDealt: number): void {
    for (const buff of this.active.slice()) buff.onHitEnemy(projectile, enemy, damageDealt)
  }

  dispatchModifyProjectileSpawn(projectile: Projectile): void {
    for (const buff of this.active) buff.modifyProjectileSpawn(projectile)
  }

  dispatchDrawPlayer(player: Player): void {
    for (const buff of this.active) buff.drawPlayer(player)
  }

  dispatchDrawEnemy(enemy: Enemy): void {
    for (const buff of this.active) buff.drawEnemy(enemy)
  }

  /** The HUD's view of this container. Skips `hidden` buffs. */
  snapshot(): BuffSlotState[] {
    return this.active
      .filter(buff => !buff.def.hidden)
      .map(buff => ({
        id: buff.id,
        msLeft: ticksToMs(buff.timeLeft),
        stats: (buff.def.stats ?? []).map(effect => ({ ...effect, value: buff.statValue(effect.stat) })),
      }))
  }

  private find(id: BuffID): Buff | undefined {
    return this.active.find(b => b.id === id)
  }
}
