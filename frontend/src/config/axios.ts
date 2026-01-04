import axios, { AxiosInstance } from 'axios'

// Create axios instance
const axiosInstance = axios.create()

// Add response interceptor to handle 401 errors
axiosInstance.interceptors.response.use(
  (response) => {
    // Pass through successful responses
    return response
  },
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response && error.response.status === 401) {
      // Don't auto-redirect on login/register endpoints (let them handle the error)
      const url = error.config?.url || ''
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')

      if (!isAuthEndpoint) {
        // Clear the expired token
        localStorage.removeItem('token')

        // Redirect to login page for other 401 errors
        window.location.href = '/login'

        // Optionally show a message (can be improved with a toast library)
        console.warn('Session expired. Please log in again.')
      }
    }

    // Reject the promise so the calling code can still handle errors
    return Promise.reject(error)
  }
)

// Add request interceptor to automatically add auth token to requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Create a typed version that includes static methods
interface AxiosWithStatics extends AxiosInstance {
  isAxiosError: typeof axios.isAxiosError
}

// Attach utility methods from original axios to the instance
const configuredAxios = axiosInstance as AxiosWithStatics
configuredAxios.isAxiosError = axios.isAxiosError

export default configuredAxios