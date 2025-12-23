import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

  // Real-time username availability check
  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) {
        setUsernameAvailable(null)
        return
      }

      setCheckingUsername(true)
      try {
        const response = await axios.get(`/api/auth/check-username/${username}`)
        setUsernameAvailable(response.data.available)
      } catch (err) {
        setUsernameAvailable(null)
      } finally {
        setCheckingUsername(false)
      }
    }

    const timeoutId = setTimeout(checkUsername, 300) // Debounce for 300ms
    return () => clearTimeout(timeoutId)
  }, [username])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!usernameAvailable) {
      setError('Username is not available')
      return
    }

    setLoading(true)

    try {
      await axios.post('/api/auth/register', {
        username,
        first_name: firstName,
        last_name: lastName,
        password
      })
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

        <div className="relative">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 bg-polygon-dark border border-gray-700 rounded text-white focus:border-polygon-primary focus:outline-none"
            required
            minLength={3}
            maxLength={50}
          />
          {username.length >= 3 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checkingUsername ? (
                <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : usernameAvailable === true ? (
                <div className="w-3 h-3 bg-green-500 rounded-full" title="Username available"></div>
              ) : usernameAvailable === false ? (
                <div className="w-3 h-3 bg-red-500 rounded-full" title="Username taken"></div>
              ) : null}
            </div>
          )}
        </div>

        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="px-4 py-3 bg-polygon-dark border border-gray-700 rounded text-white focus:border-polygon-primary focus:outline-none"
          required
          maxLength={100}
        />

        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="px-4 py-3 bg-polygon-dark border border-gray-700 rounded text-white focus:border-polygon-primary focus:outline-none"
          required
          maxLength={100}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-4 py-3 bg-polygon-dark border border-gray-700 rounded text-white focus:border-polygon-primary focus:outline-none"
          required
          minLength={6}
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
          disabled={loading || !usernameAvailable}
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
