import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import apiClient from '../api/client'

const AuthContext = createContext(null)
const STORAGE_KEY = 'school-management-auth'
const TOKEN_KEY = 'school-management-token'
const roleLabels = {
  principal: 'Principal',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  accountant: 'Accountant',
}

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function getStoredUser() {
  try {
    const storedUser = localStorage.getItem(STORAGE_KEY)
    return storedUser ? JSON.parse(storedUser) : null
  } catch {
    return null
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

function normalizeUser(backendUser) {
  return {
    ...backendUser,
    roleLabel: roleLabels[backendUser.role] || backendUser.role,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredToken() ? getStoredUser() : null)
  const [isInitializing, setIsInitializing] = useState(() => Boolean(getStoredToken()))

  useEffect(() => {
    let active = true

    const expireSession = () => {
      clearStoredSession()
      if (active) {
        setUser(null)
        setIsInitializing(false)
      }
    }

    window.addEventListener('school-auth-expired', expireSession)

    if (!getStoredToken()) {
      return () => {
        active = false
        window.removeEventListener('school-auth-expired', expireSession)
      }
    }

    apiClient.get('/auth/me')
      .then(({ data }) => {
        if (!active) return
        if (!data?.user?._id && !data?.user?.id) {
          throw new Error('The session response did not include a valid user.')
        }
        const safeUser = normalizeUser(data.user)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser))
        setUser(safeUser)
      })
      .catch(() => expireSession())
      .finally(() => {
        if (active) setIsInitializing(false)
      })

    return () => {
      active = false
      window.removeEventListener('school-auth-expired', expireSession)
    }
  }, [])

  const login = async (identifier, password) => {
    try {
      const loginValue = identifier.trim()
      const response = await apiClient.post('/auth/login', {
        identifier: loginValue,
        email: loginValue,
        loginId: loginValue,
        password,
      })
      const backendUser = response.data.user
      if (!backendUser?.role || !response.data.token) {
        return { success: false, message: 'The server returned an incomplete login response. Please try again.' }
      }
      const safeUser = normalizeUser(backendUser)
      localStorage.setItem(TOKEN_KEY, response.data.token)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser))
      setUser(safeUser)
      setIsInitializing(false)
      return { success: true, user: safeUser }
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to connect to the server. Please make sure the backend is running.'
      return { success: false, message }
    }
  }

  const updateUser = (backendUser) => {
    const safeUser = normalizeUser(backendUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser))
    setUser(safeUser)
    return safeUser
  }

  const logout = () => {
    clearStoredSession()
    setUser(null)
    setIsInitializing(false)
  }

  const value = useMemo(() => ({
    user,
    isInitializing,
    isAuthenticated: Boolean(user) && Boolean(getStoredToken()),
    login,
    logout,
    updateUser,
  }), [user, isInitializing])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
