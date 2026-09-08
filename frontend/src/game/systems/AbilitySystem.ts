import type Phaser from 'phaser'
import { UpgradeSystem } from './upgrades/UpgradeSystem'
import { UpgradeEffectSystem } from './upgrades/UpgradeEffectSystem'
import { UpgradeModifierSystem } from './upgrades/UpgradeModifierSystem'
import { UpgradeTargetID, type UpgradeStatID } from '../data/ID'
import { UPGRADE_REGISTRY } from '../upgrades'
import type { AbilityActivation, Upgrade } from '../upgrades/Upgrade'

/**
 * Runtime for on-demand abilities — the single dispatch point between input
 * and the Upgrade.onActivate hook.
 *
 * Every upgrade whose def carries an `activation` block is bound here at
 * scene start, whether or not the player owns it yet; the handler re-checks
 * ownership on each press, so buying or losing an ability mid-run needs no
 * listener churn. Charge queues, cooldown modifiers, keybinds and the HUD/
 * touch-button state are all derived from that same def, which is what keeps
 * MainScene, TouchControlManager and AbilityDisplay free of per-ability code.
 */

/**
 * Sequential charge queue: charges recharge one after another in the order
 * they were spent, so holding N charges never means N parallel timers.
 * Lifted from Player's old dash bookkeeping with the timing rules intact.
 */
class ChargeQueue {
  private readyTimes: number[] = [0]
  private rechargeStartTimes: number[] = [0]
  private lastReadyTime: number = 0
  private max: number = 1

  /** Resize and refill. Every charge comes back ready, matching the old
   *  setMaxDashCharges() that replay() called to rebuild dash state. */
  setMax(max: number): void {
    this.max = Math.max(1, max)
    this.readyTimes = Array(this.max).fill(0)
    this.rechargeStartTimes = Array(this.max).fill(0)
    this.lastReadyTime = 0
  }

  getMax(): number {
    return this.max
  }

  readyCount(now: number): number {
    let ready = 0
    for (let i = 0; i < this.max; i++) {
      if (this.readyTimes[i] <= now) ready++
    }
    return ready
  }

  /** Spend one ready charge, queueing its recharge behind any already in
   *  flight. Returns false when nothing is available. */
  spend(now: number, cooldown: number): boolean {
    let index = -1
    for (let i = 0; i < this.max; i++) {
      if (this.readyTimes[i] <= now) {
        index = i
        break
      }
    }
    if (index === -1) return false

    const startTime = Math.max(now, this.lastReadyTime)
    const readyTime = startTime + cooldown
    this.readyTimes[index] = readyTime
    this.rechargeStartTimes[index] = startTime
    if (readyTime > this.lastReadyTime) this.lastReadyTime = readyTime
    return true
  }

  /** 0..1 progress of the charge next to come back; 1 when none are out. */
  progress(now: number, cooldown: number): number {
    let nextIndex = -1
    let earliest = Infinity
    for (let i = 0; i < this.max; i++) {
      if (this.readyTimes[i] > now && this.readyTimes[i] < earliest) {
        nextIndex = i
        earliest = this.readyTimes[i]
      }
    }
    if (nextIndex === -1) return 1

    const elapsed = now - this.rechargeStartTimes[nextIndex]
    return Math.min(1, elapsed / cooldown)
  }
}

/** One ability's presentation state, consumed by the HUD. */
export interface AbilitySlotState {
  id: string
  label: string
  keyLabel: string
  theme: string
  /** Charges usable right now. */
  ready: number
  /** Charge ceiling. */
  max: number
  /** 0..1 recharge progress of the next charge; 1 when nothing is recharging. */
  progress: number
  /** Recharging abilities draw a progress bar, consumable ones draw pips. */
  recharges: boolean
}

/** A registered activation binding — the def half, independent of ownership. */
export interface AbilityBinding {
  id: string
  activation: AbilityActivation
  /** UpgradeEffectSystem counter backing a consumable ability's charges. */
  effect?: string
  maxStacks?: number
}

class AbilitySystemClass {
  private scene: Phaser.Scene | null = null
  private bindings: AbilityBinding[] = []
  private queues: Map<string, ChargeQueue> = new Map()
  private keyHandlers: { event: string; handler: () => void }[] = []

  /**
   * Bind every registered activation to its key. Called once per scene, after
   * the player exists. Bindings come from the upgrade registry rather than
   * from what the player owns, so ownership can change without rebinding.
   */
  bind(scene: Phaser.Scene): void {
    this.unbind()
    this.scene = scene

    this.bindings = Object.values(UPGRADE_REGISTRY)
      .filter(entry => entry.def.activation)
      .map(entry => ({
        id: entry.def.id,
        activation: entry.def.activation!,
        effect: entry.def.effect,
        maxStacks: entry.def.maxStacks,
      }))
      .sort((a, b) => a.activation.slot - b.activation.slot)

    this.resetCharges()

    const keyboard = scene.input.keyboard
    if (!keyboard) return
    for (const binding of this.bindings) {
      const event = `keydown-${binding.activation.key}`
      const handler = () => this.activate(binding.id)
      keyboard.on(event, handler)
      this.keyHandlers.push({ event, handler })
    }
  }

  /**
   * Drop every listener and all scene-held state. Called on scene shutdown,
   * and again by bind() — a scene restart that never shut down cleanly would
   * otherwise leave the old handlers attached and fire each ability twice.
   */
  unbind(): void {
    const keyboard = this.scene?.input.keyboard
    if (keyboard) {
      for (const { event, handler } of this.keyHandlers) keyboard.off(event, handler)
    }
    this.keyHandlers = []
    this.scene = null
    this.bindings = []
    this.queues.clear()
  }

  /**
   * Trigger an ability by id — the one path in from both the keybind and the
   * mobile button. Ownership and charge availability are checked here; every
   * other condition belongs in the ability's own onActivate.
   */
  activate(abilityId: string): void {
    if (!this.scene) return

    const binding = this.findBinding(abilityId)
    const instance = binding && this.findOwned(abilityId)
    if (!binding || !instance) return

    const now = this.scene.time.now
    const queue = this.recharges(binding) ? this.queues.get(abilityId) : undefined
    if (queue && queue.readyCount(now) === 0) return

    if (!instance.onActivate(UpgradeSystem.getContext())) return

    queue?.spend(now, this.cooldownFor(binding.activation))
  }

  /** True when the player owns the ability and it can currently be fired. */
  isAvailable(abilityId: string): boolean {
    const binding = this.findBinding(abilityId)
    if (!binding || !this.findOwned(abilityId)) return false
    if (this.recharges(binding)) return true
    // Consumable: the effect counter is the whole story.
    return this.chargesFromEffect(binding) > 0
  }

  /** Every registered binding in display order, owned or not. */
  getBindings(): readonly AbilityBinding[] {
    return this.bindings
  }

  /** HUD state for each owned ability, in slot order. */
  getSlots(): AbilitySlotState[] {
    const now = this.scene?.time.now ?? 0
    const slots: AbilitySlotState[] = []

    for (const binding of this.bindings) {
      if (!this.findOwned(binding.id)) continue
      const { activation } = binding

      if (this.recharges(binding)) {
        const queue = this.queues.get(binding.id)
        const cooldown = this.cooldownFor(activation)
        slots.push({
          id: binding.id,
          label: activation.label,
          keyLabel: activation.keyLabel ?? activation.key,
          theme: activation.theme,
          ready: queue?.readyCount(now) ?? 0,
          max: queue?.getMax() ?? 1,
          progress: queue?.progress(now, cooldown) ?? 1,
          recharges: true,
        })
      } else {
        const charges = this.chargesFromEffect(binding)
        if (charges <= 0) continue
        slots.push({
          id: binding.id,
          label: activation.label,
          keyLabel: activation.keyLabel ?? activation.key,
          theme: activation.theme,
          ready: charges,
          max: binding.maxStacks ?? charges,
          progress: 1,
          recharges: false,
        })
      }
    }

    return slots
  }

  // ============================================================
  // CHARGE CONTROL — the AbilityRuntimeLike surface upgrades use
  // ============================================================

  /** Set an ability's charge ceiling (Double Dash, Triple Dash, ...). */
  setCharges(abilityId: string, charges: number): void {
    this.queues.get(abilityId)?.setMax(charges)
  }

  /** Adjust an ability's charge ceiling relative to its current value. */
  addCharges(abilityId: string, delta: number): void {
    const queue = this.queues.get(abilityId)
    if (queue) queue.setMax(queue.getMax() + delta)
  }

  /**
   * Rebuild every queue at its def baseline. Called from UpgradeSystem.replay()
   * before the ledger is re-applied, so charge upgrades re-stack from scratch
   * instead of compounding.
   */
  resetCharges(): void {
    this.queues.clear()
    for (const binding of this.bindings) {
      if (!this.recharges(binding)) continue
      const queue = new ChargeQueue()
      queue.setMax(binding.activation.charges ?? 1)
      this.queues.set(binding.id, queue)
    }
  }

  // ============================================================
  // INTERNALS
  // ============================================================

  private recharges(binding: AbilityBinding): boolean {
    return binding.activation.cooldown !== undefined
  }

  private findBinding(abilityId: string): AbilityBinding | undefined {
    return this.bindings.find(binding => binding.id === abilityId)
  }

  /** First owned instance of the upgrade — stackable abilities like shield
   *  sit in the ledger once per stack, and they all share one activation. */
  private findOwned(abilityId: string): Upgrade | undefined {
    return UpgradeSystem.getOwned().find(instance => instance.id === abilityId)
  }

  private chargesFromEffect(binding: AbilityBinding): number {
    return binding.effect ? UpgradeEffectSystem.getEffectValue(binding.effect) : 0
  }

  private cooldownFor(activation: AbilityActivation): number {
    const base = activation.cooldown ?? 0
    if (!activation.cooldownStat) return base
    return UpgradeModifierSystem.applyModifiers(
      UpgradeTargetID.Player,
      activation.cooldownStat as UpgradeStatID,
      base
    )
  }
}

export const AbilitySystem = new AbilitySystemClass()
