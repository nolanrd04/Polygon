import { useEffect, useState } from 'react'
import {
  RESERVED_KEYS,
  assignKey,
  bindingsEqual,
  formatKeyLabel,
  getAllBindings,
  getDefaultBindings,
  getKeybindActions,
  keyNameFromEvent,
  saveBindings,
  type BindingMap,
  type KeybindAction,
} from '../game/core/Keybinds'

interface Capturing {
  actionId: string
  slot: 0 | 1
}

/**
 * Keybind rows for SettingsPanel. Edits go into a local draft and are only
 * written on Apply; leaving the panel without applying drops them. The capture
 * listener runs in the window's capture phase and stops propagation, so the
 * press never reaches GamePage's pause handler or IntermissionBar's shortcuts.
 */
export default function KeybindSettings() {
  const [saved, setSaved] = useState<BindingMap>(getAllBindings)
  const [draft, setDraft] = useState<BindingMap>(saved)
  const [capturing, setCapturing] = useState<Capturing | null>(null)
  const dirty = !bindingsEqual(draft, saved)

  useEffect(() => {
    if (!capturing) return
    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      const name = keyNameFromEvent(event)
      if (name === 'ESC') {
        setCapturing(null)
        return
      }
      if (!name || RESERVED_KEYS.has(name)) return
      setDraft(current => assignKey(current, capturing.actionId, capturing.slot, name))
      setCapturing(null)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [capturing])

  const apply = () => {
    saveBindings(draft)
    setSaved(draft)
    setCapturing(null)
  }

  const actions = getKeybindActions()
  const groups = [...new Set(actions.map(action => action.group))]

  const slot = (action: KeybindAction, index: 0 | 1) => {
    const isCapturing = capturing?.actionId === action.id && capturing.slot === index
    const key = draft[action.id]?.[index] ?? null
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setCapturing(isCapturing ? null : { actionId: action.id, slot: index })}
          className={`w-20 h-6 border rounded transition-colors truncate ${
            isCapturing
              ? 'text-[8px] tracking-tight font-semibold border-polygon-primary text-polygon-primary animate-pulse'
              : 'text-xs font-bold border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white'
          }`}
        >
          {isCapturing ? 'ESC TO CANCEL' : formatKeyLabel(key)}
        </button>
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setDraft(current => assignKey(current, action.id, index, null))}
          disabled={!key}
          title="Clear"
          className={`w-4 text-sm leading-none ${
            key ? 'text-gray-500 hover:text-polygon-danger' : 'text-transparent cursor-default'
          }`}
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-gray-700">
      <div className="flex justify-between items-center">
        <span className="text-gray-300 font-semibold">Keybinds</span>
        <button
          type="button"
          onClick={() => setDraft(getDefaultBindings())}
          className="px-2 py-1 text-xs border border-gray-600 text-gray-400 rounded hover:border-gray-400 hover:text-white transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
      <p className="text-gray-500 text-xs">Click a slot, then press a key. Changes apply when you press Apply.</p>

      {groups.map(group => (
        <div key={group} className="flex flex-col gap-1">
          <span className="text-gray-500 text-xs uppercase tracking-wider mt-2">{group}</span>
          {actions
            .filter(action => action.group === group)
            .map(action => (
              <div key={action.id} className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">{action.label}</span>
                <div className="flex gap-2">
                  {slot(action, 0)}
                  {slot(action, 1)}
                </div>
              </div>
            ))}
        </div>
      ))}

      <div className="flex justify-end items-center gap-2 mt-2">
        {dirty && <span className="text-polygon-warning text-xs mr-auto">Unsaved changes</span>}
        <button
          type="button"
          onClick={() => {
            setDraft(saved)
            setCapturing(null)
          }}
          disabled={!dirty}
          className={`px-3 py-1 text-xs border rounded transition-colors ${
            dirty
              ? 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
              : 'border-gray-700 text-gray-600 cursor-default'
          }`}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!dirty}
          className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
            dirty ? 'bg-polygon-primary text-black hover:bg-green-400' : 'bg-gray-700 text-gray-500 cursor-default'
          }`}
        >
          Apply
        </button>
      </div>
    </div>
  )
}