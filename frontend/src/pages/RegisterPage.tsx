import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      await axios.post('/api/auth/register', { username, email, password })
      navigate('/login')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Registration failed')
      } else {
        setError('Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-polygon-darker">
      <h1 className="text-4xl font-bold text-polygon-primary mb-8">REGISTER</h1>

      <form onSubmit={handleSubmit} className="w-80 flex flex-col gap-4">
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="px-4 py-3 bg-polygon-dark border border-gray-700 rounded text-white focus:border-polygon-primary focus:outline-none"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-4 py-3 bg-polygon-dark border border-gray-700 rounded text-white focus:border-polygon-primary focus:outline-none"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-4 py-3 bg-polygon-dark border border-gray-700 rounded text-white focus:border-polygon-primary focus:outline-none"
          required
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="px-4 py-3 bg-polygon-dark border border-gray-700 rounded text-white focus:border-polygon-primary focus:outline-none"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="px-8 py-3 bg-polygon-primary text-black font-bold rounded hover:bg-green-400 transition-all disabled:opacity-50"
        >
          {loading ? 'CREATING ACCOUNT...' : 'REGISTER'}
        </button>

        <div className="text-center text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-polygon-secondary hover:underline">
            Login
          </Link>
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          Back to Menu
        </button>
      </form>
    </div>
  )
}
