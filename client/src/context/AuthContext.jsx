import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const DEMO_USERS = [
  {
    id: 'usr-principal-001',
    name: 'Dr. Ananya Sharma',
    email: 'principal@school.com',
    password: '123456',
    role: 'principal',
    roleLabel: 'Principal',
  },
  {
    id: 'usr-teacher-001',
    name: 'Rahul Mehta',
    email: 'teacher@school.com',
    password: '123456',
    role: 'teacher',
    roleLabel: 'Teacher',
  },
  {
    id: 'usr-student-001',
    name: 'Aarav Sharma',
    email: 'student@school.com',
    password: '123456',
    role: 'student',
    roleLabel: 'Student',
  },
  {
    id: 'usr-parent-001',
    name: 'Rahul Sharma',
    email: 'parent@school.com',
    password: '123456',
    role: 'parent',
    roleLabel: 'Parent',
  },
  {
    id: 'usr-accountant-001',
    name: 'Neha Kapoor',
    email: 'accountant@school.com',
    password: '123456',
    role: 'accountant',
    roleLabel: 'Accountant',
  },
]

const STORAGE_KEY = 'school-management-auth'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY)
      return storedUser ? JSON.parse(storedUser) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  const login = (email, password) => {
    const normalizedEmail = email.trim().toLowerCase()
    const matchedUser = DEMO_USERS.find(
      (item) => item.email === normalizedEmail && item.password === password,
    )

    if (!matchedUser) {
      return { success: false, message: 'Invalid email or password.' }
    }

    const safeUser = {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      roleLabel: matchedUser.roleLabel,
    }

    setUser(safeUser)
    return { success: true, user: safeUser }
  }

  const logout = () => setUser(null)

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
