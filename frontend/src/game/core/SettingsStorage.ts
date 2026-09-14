// Reads the 'gameSettings' blob persisted by SettingsPage.tsx and exposes it
// as live getters so gameplay code always sees the current value without
// needing to be told when a setting changes.

interface StoredSettings {
  musicVolume?: number
  sfxVolume?: number
  showEnemyHealthBar?: boolean
  showEnemyHealthNumber?: boolean
  showFPS?: boolean
  showDiagnostics?: boolean
  brightness?: number
}

/**
 * Factory values for every stored setting, in the units SettingsPage persists
 * them in (volumes and brightness as 0-100 percentages).
 *
 * Single source of truth on purpose: the getters below fall back to these, the
 * page seeds new blobs from them, and its per-slider "Default" buttons reset to
 * them. Three copies of the number is how a reset button ends up restoring
 * something that was never the default.
 */
export const SETTINGS_DEFAULTS = {
  musicVolume: 100,
  sfxVolume: 100,
  /** 10% ambient - matches MainScene's authored BASE_AMBIENT of 0.10. */
  brightness: 10,
  fullscreen: false,
  showFPS: false,
  showDiagnostics: false,
  screenShake: true,
  showEnemyHealthBar: true,
  showEnemyHealthNumber: true
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
    return getSettingsFromStorage()?.showEnemyHealthBar ?? SETTINGS_DEFAULTS.showEnemyHealthBar
  },
  get showEnemyHealthNumber(): boolean {
    return getSettingsFromStorage()?.showEnemyHealthNumber ?? SETTINGS_DEFAULTS.showEnemyHealthNumber
  },
  /** Music volume as a 0-1 scale factor (SettingsPage stores it as 0-100). */
  get musicVolume(): number {
    return (getSettingsFromStorage()?.musicVolume ?? SETTINGS_DEFAULTS.musicVolume) / 100
  },
  /** SFX volume as a 0-1 scale factor (SettingsPage stores it as 0-100). */
  get sfxVolume(): number {
    return (getSettingsFromStorage()?.sfxVolume ?? SETTINGS_DEFAULTS.sfxVolume) / 100
  },
  /** Show the small player-facing readout: fps, enemies, projectiles. */
  get showFPS(): boolean {
    return getSettingsFromStorage()?.showFPS ?? SETTINGS_DEFAULTS.showFPS
  },
  /**
   * Expand that readout with the developer timings (update/lighting ms, light
   * groups, flood window, peaks). Only offered while showFPS is on - see
   * PerfOverlay for how the two combine.
   */
  get showDiagnostics(): boolean {
    return getSettingsFromStorage()?.showDiagnostics ?? SETTINGS_DEFAULTS.showDiagnostics
  },
  /**
   * Ambient light level the player asked for, 0.05-1.0 (SettingsPage stores it
   * as a percentage, 100% being a fully lit world). 0.10 is the default and
   * matches MainScene's authored BASE_AMBIENT.
   *
   * This is the TARGET, not something to hand straight to `ambient`: raising
   * ambient alone flattens every light in the game. MainScene divides it by
   * BASE_AMBIENT to get the multiplier that scales ambient and all lights
   * together - see BRIGHTNESS IS NOT AMBIENT in LightingSystem.
   */
  get brightness(): number {
    return (getSettingsFromStorage()?.brightness ?? SETTINGS_DEFAULTS.brightness) / 100
  }
}
