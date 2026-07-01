import { useNavigate } from 'react-router-dom'

interface UpdateNote {
  version: string
  date: string
  title: string
  changes: string[]
}

// Add new updates at the top of this array
const UPDATE_NOTES: UpdateNote[] = [
  {
    version: 'v0.1.5',
    date: '2026-07-02',
    title: 'Enemy changes',
    changes: [
      'Changed how enemies scale throughout waves.',
      'Super pentagon now detonates on death.'
    ]
  },
  {
    version: 'v0.1.4',
    date: '2026-07-01',
    title: 'minor enemy and upgrade changes',
    changes: [
      'Added more curses.',
      'Nerfed dash upgrades.',
      'Changes curses to be a 30% chance.',
      'Changed octogon to blue.',
      'Changed pentagon to orange and teleports when close to the player.'
    ]
  },
  {
    version: 'v0.1.3',
    date: '2026-07-01',
    title: 'More Boss Drops',
    changes: [
      'Boss drops multuple bundles on death',
      'Added a DifficultID enum to compare against'
    ]
  },
  {
    version: 'v0.1.2',
    date: '2026-06-29',
    title: 'Added Update Notes Page',
    changes: [
      'Added a new page to view update notes and changelog',
      'Update notes are now accessible from the main menu',
    ],
  },
  {
    version: 'v0.1.1',
    date: '2026-06-29',
    title: 'Drop Bundles & Audio Polish',
    changes: [
      'Enemies now drop upgrade bundles on death',
      'Explosions, projectile collisions, and enemy deaths no longer stack audio',
      'Boss no longer teleports too close to the player',
      'Added defense stat to the boss and reduced its health'
    ],
  },
  {
    version: 'v0.1.0',
    date: '2026-06-01',
    title: 'Initial Release',
    changes: [
      'Core gameplay loop: survive waves of polygon enemies',
      'Multiple attack types to be added',
      'Upgrade system with stat, effect, ability, and visual upgrades',
      'Online save system with account login',
      'Offline play mode',
    ],
  },
]

export default function UpdateNotesPage() {
  const navigate = useNavigate()

  return (
    <div className="w-full h-screen flex flex-col items-center py-16 px-4 bg-polygon-darker overflow-y-auto">
      <h1 className="text-4xl font-bold text-polygon-primary mb-2 tracking-wider">UPDATE NOTES</h1>
      <p className="text-gray-500 text-sm mb-10">Polygon development changelog</p>

      <div className="w-full max-w-xl flex flex-col gap-6">
        {UPDATE_NOTES.map((note) => (
          <div
            key={note.version}
            className="border border-gray-700 rounded bg-gray-900/40 p-6"
          >
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-polygon-primary font-bold text-lg">{note.version}</h2>
              <span className="text-gray-500 text-xs">{note.date}</span>
            </div>
            <h3 className="text-white font-semibold mb-3">{note.title}</h3>
            <ul className="flex flex-col gap-1.5">
              {note.changes.map((change, i) => (
                <li key={i} className="text-gray-300 text-sm flex gap-2">
                  <span className="text-polygon-primary mt-0.5">•</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/')}
        className="mt-10 px-8 py-3 border-2 border-gray-600 text-gray-400 font-semibold rounded hover:border-gray-400 hover:text-white transition-all"
      >
        BACK TO MENU
      </button>
    </div>
  )
}
