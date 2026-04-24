import { useEffect, useRef, useState } from 'react'
import { exportLocalSave, summarizeLocalSave } from '../game/services/LocalSaveManager'

interface SaveGameModalProps {
  onClose: () => void
}

export default function SaveGameModal({ onClose }: SaveGameModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [saveText] = useState(() => exportLocalSave())
  const [summary] = useState(() => summarizeLocalSave())
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    // Auto-select the text so mobile users can long-press → copy easily
    textareaRef.current?.select()
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(saveText)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[110] p-4">
      <div className="bg-polygon-darker border-2 border-polygon-primary rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-2xl font-bold text-polygon-primary mb-2">SAVE GAME</h2>
        <p className="text-gray-400 text-sm mb-4">{summary}</p>
        <p className="text-gray-500 text-xs mb-2">
          Copy the text below and paste it somewhere safe (notes, email, etc.). You can load it later from the main menu.
        </p>

        <textarea
          ref={textareaRef}
          readOnly
          value={saveText}
          className="w-full h-48 bg-black text-green-300 font-mono text-xs p-3 rounded border border-gray-700 resize-none"
        />

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleCopy}
            className="flex-1 px-6 py-3 bg-polygon-primary text-black font-bold rounded hover:bg-green-400 transition-all"
          >
            {copyStatus === 'copied' ? 'COPIED!' : copyStatus === 'failed' ? 'COPY FAILED — LONG-PRESS TEXT' : 'COPY TO CLIPBOARD'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-500 text-gray-300 font-semibold rounded hover:border-gray-300 hover:text-white transition-all"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}