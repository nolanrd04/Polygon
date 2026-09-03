import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearPerfFlag } from '../game/core/PerfStats'

interface Settings {
  musicVolume: number
  sfxVolume: number
  fullscreen: boolean
  showFPS: boolean
  showDiagnostics: boolean
  screenShake: boolean
  showEnemyHealthBar: boolean
  showEnemyHealthNumber: boolean
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('gameSettings')
    return saved ? JSON.parse(saved) : {
      musicVolume: 70,
      sfxVolume: 80,
      fullscreen: false,
      showFPS: false,
      showDiagnostics: false,
      screenShake: true,
      showEnemyHealthBar: true,
      showEnemyHealthNumber: true
    }
  })

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const newSettings = { ...settings, [key]: value }
    // A ?perf=1 from an earlier session is persisted and forces the overlay to
    // full diagnostics, which would silently override these two toggles.
    if (key === 'showFPS' || key === 'showDiagnostics') clearPerfFlag()
    setSettings(newSettings)
    localStorage.setItem('gameSettings', JSON.stringify(newSettings))
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-polygon-darker">
      <h1 className="text-4xl font-bold text-polygon-primary mb-8">SETTINGS</h1>

      <div className="w-96 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-gray-300 flex justify-between">
            Music Volume <span>{settings.musicVolume}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.musicVolume}
            onChange={(e) => updateSetting('musicVolume', parseInt(e.target.value))}
            className="w-full accent-polygon-primary"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-gray-300 flex justify-between">
            SFX Volume <span>{settings.sfxVolume}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.sfxVolume}
            onChange={(e) => updateSetting('sfxVolume', parseInt(e.target.value))}
            className="w-full accent-polygon-primary"
          />
        </div>

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
