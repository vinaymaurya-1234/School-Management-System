import axios from 'axios'

const TOKEN_KEY = 'school-management-token'
const AUTH_EXPIRED_EVENT = 'school-auth-expired'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const requestUrl = String(error.config?.url || '')
    const isLoginRequest = requestUrl.includes('/auth/login')

    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem('school-management-auth')
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }

    return Promise.reject(error)
  },
)

export default apiClient
