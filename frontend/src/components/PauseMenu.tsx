interface PauseMenuProps {
  onResume: () => void
  onQuit: () => void
}

export default function PauseMenu({ onResume, onQuit }: PauseMenuProps) {
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
          onClick={onQuit}
          className="px-8 py-3 border-2 border-polygon-danger text-polygon-danger font-semibold rounded hover:bg-polygon-danger hover:text-black transition-all"
        >
          QUIT TO MENU
        </button>
      </div>

      <p className="mt-8 text-gray-500 text-sm">Press ESC to resume</p>
    </div>
  )
}
