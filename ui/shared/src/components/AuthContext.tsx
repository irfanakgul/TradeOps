import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AuthUser = {
  username: string
  email: string
  userType: 'CLIENT' | 'ADMIN'
  deviceId: string
}

type AuthContextType = {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const STORAGE_KEY = 'tradeops_auth_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // sessiz geç
    }
  }, [user])

  function setUser(nextUser: AuthUser | null) {
    setUserState(nextUser)
  }

  const value = useMemo(
    () => ({
      user,
      setUser,
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}