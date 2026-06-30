import { useState, useEffect } from 'react'
import axios from '../config/axios'

export function useBackendConnection() {
  const [isConnected, setIsConnected] = useState(true)

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await axios.get('/api/health', { timeout: 5000 })
        setIsConnected(true)
      } catch {
        setIsConnected(false)
      }
    }

    // Check immediately on mount
    checkConnection()

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [])

  return isConnected
}