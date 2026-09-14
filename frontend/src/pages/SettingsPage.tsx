import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearPerfFlag } from '../game/core/PerfStats'
import { SETTINGS_DEFAULTS } from '../game/core/SettingsStorage'

interface Settings {
  musicVolume: number
  sfxVolume: number
  /**
   * Ambient light level as a percentage: 100 is a fully lit world, 10 is the
   * authored default. It does NOT just move ambient - MainScene turns it into a
   * multiplier over EVERY light in the game, so the picture brightens without
   * lights losing their punch. See BRIGHTNESS IS NOT AMBIENT in LightingSystem.
   */
  brightness: number
  fullscreen: boolean
  showFPS: boolean
  showDiagnostics: boolean
  screenShake: boolean
  showEnemyHealthBar: boolean
  showEnemyHealthNumber: boolean
}

/** Slider settings, and the only keys the "Default" buttons reset. */
type SliderKey = 'musicVolume' | 'sfxVolume' | 'brightness'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Settings>(() => {
    // Spread OVER the defaults rather than replacing them: a blob saved before a
    // setting existed is missing that key, and a slider handed `undefined` goes
    // uncontrolled and renders "undefined%". SETTINGS_DEFAULTS is the same table
    // SettingsStorage falls back to on the read side, so the two stay in step.
    const saved = localStorage.getItem('gameSettings')
    return saved
      ? { ...SETTINGS_DEFAULTS, ...JSON.parse(saved) }
      : { ...SETTINGS_DEFAULTS }
  })

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const newSettings = { ...settings, [key]: value }
    // A ?perf=1 from an earlier session is persisted and forces the overlay to
    // full diagnostics, which would silently override these two toggles.
    if (key === 'showFPS' || key === 'showDiagnostics') clearPerfFlag()
    setSettings(newSettings)
    localStorage.setItem('gameSettings', JSON.stringify(newSettings))
  }

  /**
   * One labelled slider with a "Default" reset beside it.
   *
   * The reset value comes from SETTINGS_DEFAULTS rather than being passed in, so
   * a button can never restore a number that is not actually the default. It
   * greys out when the slider is already there, which doubles as a readout of
   * whether this setting has been touched at all.
   */
  const slider = (key: SliderKey, label: string, min: number, max: number) => {
    const isDefault = settings[key] === SETTINGS_DEFAULTS[key]

    return (
      <div className="flex flex-col gap-2">
        <label className="text-gray-300 flex justify-between">
          {label} <span>{settings[key]}%</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={min}
            max={max}
            value={settings[key]}
            onChange={(e) => updateSetting(key, parseInt(e.target.value))}
            className="flex-1 accent-polygon-primary"
          />
          <button
            onClick={() => updateSetting(key, SETTINGS_DEFAULTS[key])}
            disabled={isDefault}
            title={`Reset to ${SETTINGS_DEFAULTS[key]}%`}
            className={`px-2 py-1 text-xs border rounded transition-colors shrink-0 ${
              isDefault
                ? 'border-gray-700 text-gray-600 cursor-default'
                : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
            }`}
          >
            Default
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-polygon-darker">
      <h1 className="text-4xl font-bold text-polygon-primary mb-8">SETTINGS</h1>

      <div className="w-96 flex flex-col gap-6">
        {slider('musicVolume', 'Music Volume', 0, 100)}
        {slider('sfxVolume', 'SFX Volume', 0, 100)}

        {/* Brightness floors at 5, not 0: at 0 the world is pitch black with no
            way back to this page from inside the game. Applied on the next scene
            start, since LightingSystem reads it in MainScene.create(). */}
        {slider('brightness', 'Brightness', 5, 100)}

        <div className="flex justify-between items-center py-2 border-t border-gray-700">
          <span className="text-gray-300">Fullscreen</span>
          <button
            onClick={() => updateSetting('fullscreen', !settings.fullscreen)}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.fullscreen ? 'bg-polygon-primary' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                settings.fullscreen ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-between items-center py-2 border-t border-gray-700">
          <span className="text-gray-300">Show FPS</span>
          <button
            onClick={() => updateSetting('showFPS', !settings.showFPS)}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.showFPS ? 'bg-polygon-primary' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                settings.showFPS ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Nested under Show FPS: the diagnostics rows are meaningless without
            the readout itself, so this only appears once it is enabled. */}
        {settings.showFPS && (
          <div className="flex justify-between items-center py-2 pl-6 border-l-2 border-gray-700 -mt-4">
            <span className="text-gray-400 text-sm">Show Diagnostics</span>
            <button
              onClick={() => updateSetting('showDiagnostics', !settings.showDiagnostics)}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.showDiagnostics ? 'bg-polygon-primary' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.showDiagnostics ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}

        <div className="flex justify-between items-center py-2 border-t border-gray-700">
          <span className="text-gray-300">Screen Shake</span>
          <button
            onClick={() => updateSetting('screenShake', !settings.screenShake)}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.screenShake ? 'bg-polygon-primary' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                settings.screenShake ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-between items-center py-2 border-t border-gray-700">
          <span className="text-gray-300">Enemy Health Bars</span>
          <button
            onClick={() => updateSetting('showEnemyHealthBar', !settings.showEnemyHealthBar)}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.showEnemyHealthBar ? 'bg-polygon-primary' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                settings.showEnemyHealthBar ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-between items-center py-2 border-t border-gray-700">
          <span className="text-gray-300">Enemy Health Numbers</span>
          <button
            onClick={() => updateSetting('showEnemyHealthNumber', !settings.showEnemyHealthNumber)}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.showEnemyHealthNumber ? 'bg-polygon-primary' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                settings.showEnemyHealthNumber ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <button
          onClick={() => navigate('/')}
          className="mt-4 px-8 py-3 border-2 border-gray-600 text-gray-400 font-semibold rounded hover:border-gray-400 hover:text-white transition-all"
        >
          BACK TO MENU
        </button>
      </div>
    </div>
  )
}
