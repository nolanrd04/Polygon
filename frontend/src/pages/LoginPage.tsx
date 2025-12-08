import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post('/api/auth/login', { email, password })
      localStorage.setItem('token', response.data.access_token)
      navigate('/')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Login failed')
      } else {
        setError('Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-polygon-darker">
      <h1 className="text-4xl font-bold text-polygon-primary mb-8">LOGIN</h1>

      <form onSubmit={handleSubmit} className="w-80 flex flex-col gap-4">
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded">
            {error}
          </div>
        )}

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

        <button
          type="submit"
          disabled={loading}
          className="px-8 py-3 bg-polygon-primary text-black font-bold rounded hover:bg-green-400 transition-all disabled:opacity-50"
        >
          {loading ? 'LOGGING IN...' : 'LOGIN'}
        </button>

        <div className="text-center text-gray-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-polygon-secondary hover:underline">
            Register
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
