import { useState } from 'react'
import SaveGameModal from './SaveGameModal'
import ViewUpgrades from './ViewUpgrades'
import ViewBuffs from './ViewBuffs'
import type { BuffSlotState } from '../game/buffs/Buff'

interface PauseMenuProps {
  onResume: () => void
  onQuit: () => void
  buffs: BuffSlotState[]
  /** 'buffs' when opened by tapping the BuffBar. BACK still lands on the menu. */
  initialView?: 'buffs'
}

export default function PauseMenu({ onResume, onQuit, buffs, initialView }: PauseMenuProps) {
  // export saves
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showUpgrades, setShowUpgrades] = useState(false)
  const [showBuffs, setShowBuffs] = useState(initialView === 'buffs')
  const isSandbox = !localStorage.getItem('token')
  //

  if (showUpgrades) {
    return <ViewUpgrades onBack={() => setShowUpgrades(false)} />
  }

  if (showBuffs) {
    return <ViewBuffs buffs={buffs} onBack={() => setShowBuffs(false)} />
  }

  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-[100]">
      <h2 className="text-4xl font-bold text-polygon-primary mb-8">PAUSED</h2>

      <div className="flex flex-col gap-4 w-64">
        <button
          onClick={onResume}
          className="px-8 py-4 bg-polygon-primary text-black font-bold text-xl rounded hover:bg-green-400 transition-all"
        >
          RESUME
        </button>

        <button
          onClick={() => setShowUpgrades(true)}
          className="px-8 py-3 border-2 border-polygon-secondary text-polygon-secondary font-semibold rounded hover:bg-polygon-secondary hover:text-black transition-all"
        >
          VIEW UPGRADES
        </button>

        <button
          onClick={() => setShowBuffs(true)}
          className="px-8 py-3 border-2 border-polygon-secondary text-polygon-secondary font-semibold rounded hover:bg-polygon-secondary hover:text-black transition-all"
        >
          VIEW BUFFS{buffs.length > 0 ? ` (${buffs.length})` : ''}
        </button>

        {isSandbox && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-8 py-3 border-2 border-polygon-secondary text-polygon-secondary font-semibold rounded hover:bg-polygon-secondary hover:text-black transition-all"
          >
            SAVE GAME
          </button>
        )}

        <button
          onClick={onQuit}
          className="px-8 py-3 border-2 border-polygon-danger text-polygon-danger font-semibold rounded hover:bg-polygon-danger hover:text-black transition-all"
        >
          QUIT TO MENU
        </button>
      </div>

      <p className="mt-8 text-gray-500 text-sm">Press ESC to resume</p>

      {showSaveModal && (
        <SaveGameModal onClose={() => setShowSaveModal(false)} />
      )}
    </div>
  )
}