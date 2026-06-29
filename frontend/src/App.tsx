import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainMenu from './pages/MainMenu'
import GamePage from './pages/GamePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/SettingsPage'
import AttackSelectPage from './pages/AttackSelectPage'
import UpdateNotesPage from './pages/UpdateNotesPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/select-attack" element={<AttackSelectPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/update-notes" element={<UpdateNotesPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
