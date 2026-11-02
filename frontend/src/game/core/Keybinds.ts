import Phaser from 'phaser'
import { EventBus } from './EventBus'
import { UPGRADE_REGISTRY } from '../upgrades'

// Player-rebindable keys. Every action holds a primary and a secondary slot;
// either one triggers it. Only the slots the player changed are persisted, so
// actions added later pick up their defaults with no migration. Keys are
// Phaser KeyCodes names ('SPACE', 'W', 'UP') - the same strings Phaser's
// addKey / `keydown-<name>` take - and DOM handlers compare via matchesKey().

export type KeyPair = [string | null, string | null]

export interface KeybindAction {
  id: string
  label: string
  group: 'Movement' | 'Abilities' | 'Waves'
  defaults: KeyPair
}

const STORAGE_KEY = 'keybinds'

/** Never bindable: Escape always pauses, so a bad binding can't lock the player out. */
export const RESERVED_KEYS = new Set(['ESC'])

export const MoveAction = {
  Up: 'moveUp',
  Down: 'moveDown',
  Left: 'moveLeft',
  Right: 'moveRight',
} as const

export const WaveAction = {
  StartWave: 'startWave',
  ToggleShop: 'toggleShop',
} as const

const STATIC_ACTIONS: KeybindAction[] = [
  { id: MoveAction.Up, label: 'Move Up', group: 'Movement', defaults: ['W', 'UP'] },
  { id: MoveAction.Down, label: 'Move Down', group: 'Movement', defaults: ['S', 'DOWN'] },
  { id: MoveAction.Left, label: 'Move Left', group: 'Movement', defaults: ['A', 'LEFT'] },
  { id: MoveAction.Right, label: 'Move Right', group: 'Movement', defaults: ['D', 'RIGHT'] },
  { id: WaveAction.StartWave, label: 'Start Wave', group: 'Waves', defaults: ['ENTER', null] },
  { id: WaveAction.ToggleShop, label: 'Toggle Shop', group: 'Waves', defaults: ['TAB', null] },
]

let cachedActions: KeybindAction[] | null = null

/** Every rebindable action. Ability rows come from each def's `activation`, keyed by upgrade id. */
export function getKeybindActions(): KeybindAction[] {
  if (cachedActions) return cachedActions
  const abilities = Object.values(UPGRADE_REGISTRY)
    .map(entry => entry.def)
    .filter(def => def.activation)
    .sort((a, b) => a.activation!.slot - b.activation!.slot)
    .map((def): KeybindAction => ({
      id: def.id,
      label: def.name,
      group: 'Abilities',
      defaults: [def.activation!.key, null],
    }))
  cachedActions = [...STATIC_ACTIONS, ...abilities]
  return cachedActions
}

function findAction(actionId: string): KeybindAction | undefined {
  return getKeybindActions().find(action => action.id === actionId)
}

function readOverrides(): Record<string, KeyPair> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

function writeOverrides(overrides: Record<string, KeyPair>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  EventBus.emit('keybinds-changed')
}

export function getBinding(actionId: string): KeyPair {
  const override = readOverrides()[actionId]
  if (override) return override
  return findAction(actionId)?.defaults ?? [null, null]
}

/** The bound keys with empty slots dropped. */
export function getBoundKeys(actionId: string): string[] {
  return getBinding(actionId).filter((key): key is string => key !== null)
}

export type BindingMap = Record<string, KeyPair>

/** Every action's saved binding, defaults filled in. */
export function getAllBindings(): BindingMap {
  const map: BindingMap = {}
  for (const action of getKeybindActions()) map[action.id] = [...getBinding(action.id)] as KeyPair
  return map
}

export function getDefaultBindings(): BindingMap {
  const map: BindingMap = {}
  for (const action of getKeybindActions()) map[action.id] = [...action.defaults] as KeyPair
  return map
}

/**
 * Return a copy of `bindings` with `key` in one slot of an action. Pure, so the
 * settings UI can edit a draft and only save on Apply. A key already used
 * elsewhere swaps with whatever this slot held, so two actions never share a
 * key. Passing null clears the slot.
 */
export function assignKey(bindings: BindingMap, actionId: string, slot: 0 | 1, key: string | null): BindingMap {
  if ((key && RESERVED_KEYS.has(key)) || !bindings[actionId]) return bindings
  const next: BindingMap = {}
  for (const [id, pair] of Object.entries(bindings)) next[id] = [...pair] as KeyPair

  const previous = next[actionId][slot]
  if (key) {
    for (const [otherId, pair] of Object.entries(next)) {
      const otherSlot = pair.indexOf(key)
      if (otherSlot === -1 || (otherId === actionId && otherSlot === slot)) continue
      pair[otherSlot] = previous
    }
  }
  next[actionId][slot] = key
  return next
}

export function bindingsEqual(a: BindingMap, b: BindingMap): boolean {
  return getKeybindActions().every(({ id }) => a[id]?.[0] === b[id]?.[0] && a[id]?.[1] === b[id]?.[1])
}

/** Persist a full binding map. Only slots that differ from the defaults are stored. */
export function saveBindings(bindings: BindingMap): void {
  const overrides: BindingMap = {}
  for (const action of getKeybindActions()) {
    const pair = bindings[action.id]
    if (pair && (pair[0] !== action.defaults[0] || pair[1] !== action.defaults[1])) overrides[action.id] = pair
  }
  writeOverrides(overrides)
}

/** True when a DOM keydown hits either of the action's keys. */
export function matchesKey(event: KeyboardEvent, actionId: string): boolean {
  const codes = Phaser.Input.Keyboard.KeyCodes as Record<string, number>
  return getBoundKeys(actionId).some(key => codes[key] === event.keyCode)
}

let codeToName: Map<number, string> | null = null

/** Phaser key name for a DOM keydown, or null if Phaser has no name for it. */
export function keyNameFromEvent(event: KeyboardEvent): string | null {
  if (!codeToName) {
    codeToName = new Map()
    for (const [name, code] of Object.entries(Phaser.Input.Keyboard.KeyCodes as Record<string, number>)) {
      if (!codeToName.has(code)) codeToName.set(code, name)
    }
  }
  return codeToName.get(event.keyCode) ?? null
}

const SHORT_LABELS: Record<string, string> = {
  SPACE: 'SPC', ENTER: 'ENT', SHIFT: 'SHFT', BACKSPACE: 'BKSP', DELETE: 'DEL',
  UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
  ZERO: '0', ONE: '1', TWO: '2', THREE: '3', FOUR: '4',
  FIVE: '5', SIX: '6', SEVEN: '7', EIGHT: '8', NINE: '9',
}

/** Compact name for HUD chips and settings buttons. */
export function formatKeyLabel(key: string | null): string {
  if (!key) return '—'
  return SHORT_LABELS[key] ?? key.replace(/_/g, ' ')
}