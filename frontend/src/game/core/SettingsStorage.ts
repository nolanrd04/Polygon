// Reads the 'gameSettings' blob persisted by SettingsPage.tsx and exposes it
// as live getters so gameplay code always sees the current value without
// needing to be told when a setting changes.

interface StoredSettings {
  musicVolume?: number
  sfxVolume?: number
  showEnemyHealthBar?: boolean
  showEnemyHealthNumber?: boolean
}

function getSettingsFromStorage(): StoredSettings | null {
  const saved = localStorage.getItem('gameSettings')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return null
    }
  }
  return null
}

export const SETTINGS = {
  get showEnemyHealthBar(): boolean {
    return getSettingsFromStorage()?.showEnemyHealthBar ?? true
  },
  get showEnemyHealthNumber(): boolean {
    return getSettingsFromStorage()?.showEnemyHealthNumber ?? true
  },
  /** Music volume as a 0-1 scale factor (SettingsPage stores it as 0-100). */
  get musicVolume(): number {
    return (getSettingsFromStorage()?.musicVolume ?? 70) / 100
  },
  /** SFX volume as a 0-1 scale factor (SettingsPage stores it as 0-100). */
  get sfxVolume(): number {
    return (getSettingsFromStorage()?.sfxVolume ?? 80) / 100
  }
}
