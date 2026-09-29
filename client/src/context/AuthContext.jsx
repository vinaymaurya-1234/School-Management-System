import { createContext, useContext, useMemo, useState } from 'react'
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

function getStoredUser() {
  try {
    const storedUser = localStorage.getItem(STORAGE_KEY)
    return storedUser ? JSON.parse(storedUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)

  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      })

      const backendUser = response.data.user
      const safeUser = {
        ...backendUser,
        roleLabel: roleLabels[backendUser.role] || backendUser.role,
      }

      localStorage.setItem(TOKEN_KEY, response.data.token)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser))
      setUser(safeUser)

      return { success: true, user: safeUser }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        'Unable to connect to the server. Please make sure the backend is running.'

      return { success: false, message }
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), login, logout }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
