import { useNavigate } from 'react-router-dom'
import SettingsPanel from '../components/SettingsPanel'

export default function SettingsPage() {
  const navigate = useNavigate()
  return (
    <SettingsPanel
      onBack={() => navigate('/')}
      backLabel="BACK TO MENU"
      className="w-full h-full bg-polygon-darker"
    />
  )
}