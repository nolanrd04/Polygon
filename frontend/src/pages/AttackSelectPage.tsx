import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ATTACK_INFO, AttackType } from '../game/data/attackTypes'
import { GiBullets, GiLaserBurst, GiLightningTrio, GiFlamethrower, GiBoltSaw } from 'react-icons/gi'

const ATTACK_ICONS: Record<AttackType, React.ReactNode> = {
  bullet: <GiBullets className="text-5xl" />,
  laser: <GiLaserBurst className="text-5xl" />,
  zapper: <GiLightningTrio className="text-5xl" />,
  flamer: <GiFlamethrower className="text-5xl" />,
  spinner: <GiBoltSaw className="text-5xl" />
}

const ATTACK_COLORS: Record<AttackType, string> = {
  bullet: 'border-green-500 hover:bg-green-900/30 text-green-500',
  laser: 'border-cyan-500 hover:bg-cyan-900/30 text-cyan-500',
  zapper: 'border-yellow-500 hover:bg-yellow-900/30 text-yellow-500',
  flamer: 'border-orange-500 hover:bg-orange-900/30 text-orange-500',
  spinner: 'border-purple-500 hover:bg-purple-900/30 text-purple-500'
}

const ATTACK_SELECTED_COLORS: Record<AttackType, string> = {
  bullet: 'border-green-400 bg-green-900/50 text-green-400',
  laser: 'border-cyan-400 bg-cyan-900/50 text-cyan-400',
  zapper: 'border-yellow-400 bg-yellow-900/50 text-yellow-400',
  flamer: 'border-orange-400 bg-orange-900/50 text-orange-400',
  spinner: 'border-purple-400 bg-purple-900/50 text-purple-400'
}

export default function AttackSelectPage() {
  const navigate = useNavigate()
  const [selectedAttack, setSelectedAttack] = useState<AttackType>('bullet')

  const attacks = Object.entries(ATTACK_INFO) as [AttackType, typeof ATTACK_INFO[AttackType]][]

  const handleStartGame = () => {
    // Store selected attack in sessionStorage for the game to read
    sessionStorage.setItem('selectedAttack', selectedAttack)
    navigate('/game')
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-polygon-darker">
      <h1 className="text-4xl font-bold text-polygon-primary mb-2">
        SELECT YOUR WEAPON
      </h1>
      <p className="text-gray-400 mb-8">Choose your starting attack type</p>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8 px-4 max-w-6xl">
        {attacks.map(([type, info]) => (
          <button
            key={type}
            onClick={() => setSelectedAttack(type)}
            className={`p-6 rounded-lg border-2 transition-all flex flex-col items-center text-center ${
              selectedAttack === type
                ? ATTACK_SELECTED_COLORS[type]
                : `border-gray-700 ${ATTACK_COLORS[type]}`
            }`}
          >
            <div className="mb-3">{ATTACK_ICONS[type]}</div>
            <h3 className="text-xl font-bold text-white mb-2">{info.name}</h3>
            <p className="text-gray-400 text-sm">{info.description}</p>
            {selectedAttack === type && (
              <div className="mt-3 text-polygon-primary font-bold text-sm">
                SELECTED
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 border-2 border-gray-600 text-gray-400 font-semibold rounded hover:border-gray-400 hover:text-white transition-all"
        >
          BACK
        </button>

        <button
          onClick={handleStartGame}
          className="px-12 py-3 bg-polygon-primary text-black font-bold text-xl rounded hover:bg-green-400 transition-all transform hover:scale-105"
        >
          START GAME
        </button>
      </div>

      <div className="mt-8 text-gray-500 text-sm max-w-md text-center">
        You can unlock upgrades for your chosen attack during gameplay.
        Different attacks excel in different situations!
      </div>
    </div>
  )
}
